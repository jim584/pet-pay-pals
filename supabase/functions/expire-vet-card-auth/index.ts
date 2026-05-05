import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";

// Cron-invoked. Walks card_issued tickets past authorized_until and freezes them.
Deno.serve(async (_req) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ISSUING_ENABLED = (Deno.env.get("ISSUING_ENABLED") ?? "false").toLowerCase() === "true";
  const stripe = ISSUING_ENABLED
    ? new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" })
    : null;

  const { data: expired } = await admin.from("vet_tickets")
    .select("id, card_id")
    .eq("status", "card_issued")
    .lt("authorized_until", new Date().toISOString());

  let count = 0;
  for (const t of expired ?? []) {
    try {
      if (stripe && t.card_id && !t.card_id.startsWith("stub_")) {
        await stripe.issuing.cards.update(t.card_id, {
          spending_controls: {
            spending_limits: [{ amount: 0, interval: "all_time" }],
            allowed_categories: ["veterinary_services"],
          },
        });
      }
      await admin.from("vet_tickets").update({ status: "expired" }).eq("id", t.id);
      await admin.rpc("release_ticket_allocations", { _ticket_id: t.id });
      await admin.from("vet_payouts").update({ status: "cancelled" })
        .eq("ticket_id", t.id).eq("status", "pending");
      count++;
    } catch (e) {
      console.error("expire-vet-card-auth ticket failed:", t.id, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, expired_count: count }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
