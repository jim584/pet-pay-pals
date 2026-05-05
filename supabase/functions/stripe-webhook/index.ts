import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";

// Public webhook endpoint — no JWT verification.
Deno.serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const sig = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    if (webhookSecret && sig) {
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
    } else {
      // Fallback (dev): parse without verification
      event = JSON.parse(rawBody) as Stripe.Event;
    }
  } catch (e) {
    console.error("Webhook signature verification failed:", e);
    return new Response(`Webhook Error: ${(e as Error).message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const md = s.metadata || {};

        // Vet ticket member-remainder payment
        if (md.kind === "vet_ticket_remainder" && md.vet_ticket_id) {
          const ticketId = md.vet_ticket_id;
          const { data: t } = await admin.from("vet_tickets")
            .select("approved_amount, status").eq("id", ticketId).maybeSingle();
          if (t && t.status === "approved") {
            await admin.from("vet_tickets").update({
              status: "funded", member_remainder_paid: true,
            }).eq("id", ticketId);
            if (Number(t.approved_amount ?? 0) > 0) {
              await admin.from("vet_payouts").insert({
                ticket_id: ticketId, amount: Number(t.approved_amount),
                method: "manual_ach", status: "pending",
              });
            }
          }
          break;
        }

        const subId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
        if (!md.user_id || !md.plan_id || !subId) break;

        const sub = await stripe.subscriptions.retrieve(subId);
        await admin.from("memberships").insert({
          user_id: md.user_id,
          pet_id: md.pet_id || null,
          plan_id: md.plan_id,
          status: "active",
          billing_interval: md.billing_interval || "month",
          is_fear_free_member: md.is_fear_free_member === "true",
          stripe_subscription_id: subId,
          stripe_customer_id: typeof s.customer === "string" ? s.customer : s.customer?.id,
          started_at: new Date().toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        });
        break;
      }

      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        const subId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id;
        if (!subId) break;

        const { data: m } = await admin.from("memberships")
          .select("id, user_id, plan_id, is_fear_free_member, billing_interval")
          .eq("stripe_subscription_id", subId).maybeSingle();
        if (!m) break;

        const { data: plan } = await admin.from("membership_plans").select("*").eq("id", m.plan_id).single();
        if (!plan) break;

        // Per-month DP accrual (annual still accrues monthly rows for rolling expiry)
        const monthlyDP = m.is_fear_free_member
          ? Number(plan.direct_pay_portion) * 0.95
          : Number(plan.direct_pay_portion);

        const monthsCovered = m.billing_interval === "year" ? 12 : 1;
        const now = new Date();

        for (let i = 0; i < monthsCovered; i++) {
          const accrualMonth = new Date(now.getFullYear(), now.getMonth() + i, 1);
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

        // Update period end
        const sub = await stripe.subscriptions.retrieve(subId);
        await admin.from("memberships").update({
          status: "active",
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq("id", m.id);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status === "active" || sub.status === "trialing" ? "active"
          : sub.status === "past_due" ? "past_due"
          : sub.status === "canceled" ? "cancelled"
          : "paused";
        await admin.from("memberships").update({
          status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq("stripe_subscription_id", sub.id);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await admin.from("memberships").update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        }).eq("stripe_subscription_id", sub.id);
        // Note: redistribution of unused DP on cancellation handled by process-dp-expiry
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stripe-webhook handler error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});
