import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Row = {
  source: "stripe" | "internal" | "both";
  status: "matched" | "missing_internal" | "missing_stripe" | "amount_mismatch" | "status_mismatch";
  stripe_transfer_id: string | null;
  internal_payout_id: string | null;
  referrer_id: string | null;
  referrer_name: string | null;
  destination_account: string | null;
  stripe_amount: number | null;
  internal_amount: number | null;
  stripe_created: string | null;
  internal_paid_at: string | null;
  internal_status: string | null;
  reversed: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await admin.from("user_roles")
      .select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "forbidden" }, 403);

    const url = new URL(req.url);
    const days = Math.min(parseInt(url.searchParams.get("days") ?? "90"), 365);
    const since = Math.floor(Date.now() / 1000) - days * 86400;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

    // Pull all Stripe transfers in the window
    const stripeTransfers: Stripe.Transfer[] = [];
    let starting_after: string | undefined;
    for (let i = 0; i < 20; i++) {
      const page = await stripe.transfers.list({ limit: 100, created: { gte: since }, starting_after });
      stripeTransfers.push(...page.data);
      if (!page.has_more) break;
      starting_after = page.data[page.data.length - 1]?.id;
    }
    const transferIds = stripeTransfers.map(t => t.id);

    // Detect reversals (transfer.amount_reversed > 0 OR fully reversed)
    const reversedSet = new Set(stripeTransfers.filter(t => (t.amount_reversed ?? 0) > 0).map(t => t.id));

    // Pull internal payouts in the window (by created_at)
    const sinceISO = new Date(since * 1000).toISOString();
    const { data: internalPayouts, error: ie } = await admin
      .from("referrer_payouts")
      .select("id, referrer_id, amount, status, stripe_transfer_id, paid_at, created_at, method, referrers(display_name, stripe_connect_account_id)")
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false });
    if (ie) throw ie;

    const internalByTransfer = new Map<string, any>();
    const internalNoTransfer: any[] = [];
    for (const p of internalPayouts ?? []) {
      if (p.stripe_transfer_id) internalByTransfer.set(p.stripe_transfer_id, p);
      else if (p.method === "stripe_connect") internalNoTransfer.push(p);
    }

    const rows: Row[] = [];

    // Walk Stripe transfers
    for (const t of stripeTransfers) {
      const internal = internalByTransfer.get(t.id);
      const stripeAmount = (t.amount ?? 0) / 100;
      if (!internal) {
        rows.push({
          source: "stripe",
          status: "missing_internal",
          stripe_transfer_id: t.id,
          internal_payout_id: null,
          referrer_id: (t.metadata?.referrer_id as string) ?? null,
          referrer_name: null,
          destination_account: typeof t.destination === "string" ? t.destination : (t.destination as any)?.id ?? null,
          stripe_amount: stripeAmount,
          internal_amount: null,
          stripe_created: new Date((t.created ?? 0) * 1000).toISOString(),
          internal_paid_at: null,
          internal_status: null,
          reversed: reversedSet.has(t.id),
        });
        continue;
      }
      const internalAmount = Number(internal.amount);
      const amountOk = Math.abs(internalAmount - stripeAmount) < 0.01;
      const statusOk = internal.status === "paid";
      let status: Row["status"] = "matched";
      if (!amountOk) status = "amount_mismatch";
      else if (!statusOk) status = "status_mismatch";
      rows.push({
        source: "both",
        status,
        stripe_transfer_id: t.id,
        internal_payout_id: internal.id,
        referrer_id: internal.referrer_id,
        referrer_name: internal.referrers?.display_name ?? null,
        destination_account: typeof t.destination === "string" ? t.destination : (t.destination as any)?.id ?? null,
        stripe_amount: stripeAmount,
        internal_amount: internalAmount,
        stripe_created: new Date((t.created ?? 0) * 1000).toISOString(),
        internal_paid_at: internal.paid_at,
        internal_status: internal.status,
        reversed: reversedSet.has(t.id),
      });
    }

    // Internal stripe_connect payouts that reference a transfer not seen on Stripe (could be older than window)
    for (const p of internalPayouts ?? []) {
      if (!p.stripe_transfer_id) continue;
      if (transferIds.includes(p.stripe_transfer_id)) continue;
      rows.push({
        source: "internal",
        status: "missing_stripe",
        stripe_transfer_id: p.stripe_transfer_id,
        internal_payout_id: p.id,
        referrer_id: p.referrer_id,
        referrer_name: p.referrers?.display_name ?? null,
        destination_account: p.referrers?.stripe_connect_account_id ?? null,
        stripe_amount: null,
        internal_amount: Number(p.amount),
        stripe_created: null,
        internal_paid_at: p.paid_at,
        internal_status: p.status,
        reversed: false,
      });
    }

    // Internal stripe_connect payouts with no transfer id at all
    for (const p of internalNoTransfer) {
      rows.push({
        source: "internal",
        status: "missing_stripe",
        stripe_transfer_id: null,
        internal_payout_id: p.id,
        referrer_id: p.referrer_id,
        referrer_name: p.referrers?.display_name ?? null,
        destination_account: p.referrers?.stripe_connect_account_id ?? null,
        stripe_amount: null,
        internal_amount: Number(p.amount),
        stripe_created: null,
        internal_paid_at: p.paid_at,
        internal_status: p.status,
        reversed: false,
      });
    }

    rows.sort((a, b) => (b.stripe_created ?? b.internal_paid_at ?? "").localeCompare(a.stripe_created ?? a.internal_paid_at ?? ""));

    const summary = {
      window_days: days,
      stripe_transfer_count: stripeTransfers.length,
      internal_payout_count: (internalPayouts ?? []).filter(p => p.method === "stripe_connect").length,
      matched: rows.filter(r => r.status === "matched").length,
      missing_internal: rows.filter(r => r.status === "missing_internal").length,
      missing_stripe: rows.filter(r => r.status === "missing_stripe").length,
      amount_mismatch: rows.filter(r => r.status === "amount_mismatch").length,
      status_mismatch: rows.filter(r => r.status === "status_mismatch").length,
      reversed: rows.filter(r => r.reversed).length,
      stripe_total: stripeTransfers.reduce((s, t) => s + (t.amount ?? 0), 0) / 100,
      internal_total: (internalPayouts ?? []).filter(p => p.method === "stripe_connect").reduce((s, p) => s + Number(p.amount), 0),
    };

    return json({ summary, rows });
  } catch (e) {
    console.error("referrer-reconcile error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
