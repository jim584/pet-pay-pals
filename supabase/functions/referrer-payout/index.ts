import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { referrer_id } = await req.json();
    if (!referrer_id) return json({ error: "referrer_id required" }, 400);

    const { data: referrer } = await admin.from("referrers")
      .select("id, display_name, stripe_connect_account_id, stripe_connect_status")
      .eq("id", referrer_id).maybeSingle();
    if (!referrer) return json({ error: "referrer not found" }, 404);
    if (!referrer.stripe_connect_account_id || referrer.stripe_connect_status !== "active") {
      return json({ error: "Stripe Connect account not active" }, 400);
    }

    const { data: avail, error: e1 } = await admin.from("referral_bounties")
      .select("id, bounty_amount").eq("referrer_id", referrer_id).eq("status", "available");
    if (e1) throw e1;
    if (!avail || avail.length === 0) return json({ error: "no available bounties" }, 400);

    const total = avail.reduce((s: number, b: any) => s + Number(b.bounty_amount), 0);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

    const transfer = await stripe.transfers.create({
      amount: Math.round(total * 100),
      currency: "usd",
      destination: referrer.stripe_connect_account_id,
      description: `Referral payout to ${referrer.display_name}`,
      metadata: { referrer_id },
    });

    const { data: payout, error: e2 } = await admin.from("referrer_payouts").insert({
      referrer_id,
      amount: total,
      method: "stripe_connect",
      status: "paid",
      stripe_transfer_id: transfer.id,
      paid_at: new Date().toISOString(),
    }).select().single();
    if (e2) throw e2;

    await admin.from("referral_bounties")
      .update({ status: "paid", payout_id: payout.id, paid_at: new Date().toISOString() })
      .in("id", avail.map((b: any) => b.id));

    return json({ ok: true, transfer_id: transfer.id, amount: total, count: avail.length });
  } catch (e) {
    console.error("referrer-payout error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
