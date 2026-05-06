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
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

    const { data: memberships } = await admin
      .from("memberships")
      .select("id, user_id, plan_id, is_fear_free_member, billing_interval, stripe_subscription_id")
      .not("stripe_subscription_id", "is", null);

    let synced = 0;
    let created = 0;

    for (const m of memberships ?? []) {
      const invoices = await stripe.invoices.list({
        subscription: m.stripe_subscription_id!,
        limit: 100,
      });

      const { data: plan } = await admin
        .from("membership_plans")
        .select("*")
        .eq("id", m.plan_id)
        .single();

      for (const inv of invoices.data) {
        synced++;
        const status = inv.status === "paid" ? "paid"
          : inv.status === "open" || inv.status === "uncollectible" ? "failed"
          : inv.status ?? "unknown";

        const { data: existing } = await admin
          .from("payment_history")
          .select("id")
          .eq("stripe_invoice_id", inv.id)
          .maybeSingle();

        const { error: upsertErr } = await admin
          .from("payment_history")
          .upsert({
            user_id: m.user_id,
            membership_id: m.id,
            kind: "membership_invoice",
            status,
            amount: (inv.amount_paid ?? inv.amount_due ?? 0) / 100,
            currency: inv.currency || "usd",
            description: inv.lines?.data?.[0]?.description || `${plan?.tier_label ?? "Membership"} invoice`,
            stripe_invoice_id: inv.id,
            stripe_charge_id: typeof inv.charge === "string" ? inv.charge : inv.charge?.id ?? null,
            stripe_payment_intent_id: typeof inv.payment_intent === "string" ? inv.payment_intent : inv.payment_intent?.id ?? null,
            stripe_subscription_id: m.stripe_subscription_id,
            hosted_invoice_url: inv.hosted_invoice_url ?? null,
            invoice_pdf: inv.invoice_pdf ?? null,
            occurred_at: new Date(((inv.status_transitions?.paid_at ?? inv.created) || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
          }, { onConflict: "stripe_invoice_id" });

        if (upsertErr) {
          console.error("upsert payment_history failed:", upsertErr);
          continue;
        }
        if (!existing) created++;

        // Backfill DP accruals only for paid invoices that don't have rows yet
        if (status === "paid" && plan) {
          const { data: existingAccrual } = await admin
            .from("direct_pay_accruals")
            .select("id")
            .eq("stripe_invoice_id", inv.id)
            .limit(1)
            .maybeSingle();
          if (!existingAccrual) {
            const monthlyDP = m.is_fear_free_member
              ? Number(plan.direct_pay_portion) * 0.95
              : Number(plan.direct_pay_portion);
            const monthsCovered = m.billing_interval === "year" ? 12 : 1;
            const base = new Date(((inv.status_transitions?.paid_at ?? inv.created) || Math.floor(Date.now() / 1000)) * 1000);
            for (let i = 0; i < monthsCovered; i++) {
              const accrualMonth = new Date(base.getFullYear(), base.getMonth() + i, 1);
              const expiresAt = plan.dp_window_months
                ? new Date(accrualMonth.getFullYear(), accrualMonth.getMonth() + plan.dp_window_months, 1)
                : null;
              await admin.from("direct_pay_accruals").insert({
                membership_id: m.id,
                user_id: m.user_id,
                accrual_month: accrualMonth.toISOString().slice(0, 10),
                amount: monthlyDP,
                remaining_amount: monthlyDP,
                expires_at: expiresAt ? expiresAt.toISOString() : null,
                stripe_invoice_id: inv.id,
              });
            }
          }
        }
      }
    }

    return json({ synced, created });
  } catch (e) {
    console.error("backfill-payment-history error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
