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
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await sb.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await admin.from("profiles")
      .select("full_name, phone, address, stripe_issuing_cardholder_id")
      .eq("user_id", userId).maybeSingle();
    if (!profile?.address) return json({ error: "Add a shipping address to your profile first" }, 400);

    const { data: existingPhys } = await admin.from("issued_cards")
      .select("*").eq("owner_id", userId).eq("type", "physical").maybeSingle();
    if (existingPhys) return json({ ok: true, card: existingPhys, idempotent: true });

    const ISSUING_ENABLED = (Deno.env.get("ISSUING_ENABLED") ?? "false").toLowerCase() === "true";
    if (!ISSUING_ENABLED) {
      return json({ error: "Physical card ordering not yet enabled. Please check back soon." }, 503);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

    let cardholderId = profile.stripe_issuing_cardholder_id;
    if (!cardholderId) {
      const ch = await stripe.issuing.cardholders.create({
        type: "individual",
        name: profile.full_name || "Pet Owner",
        phone_number: profile.phone || undefined,
        billing: {
          address: { line1: profile.address, city: "—", state: "—", postal_code: "00000", country: "US" },
        },
      });
      cardholderId = ch.id;
      await admin.from("profiles").update({ stripe_issuing_cardholder_id: cardholderId }).eq("user_id", userId);
    }

    const card = await stripe.issuing.cards.create({
      type: "physical",
      cardholder: cardholderId!,
      currency: "usd",
      status: "inactive",
      spending_controls: {
        spending_limits: [{ amount: 0, interval: "all_time" }],
        allowed_categories: ["veterinary_services"],
      },
      shipping: {
        name: profile.full_name || "Pet Owner",
        address: { line1: profile.address!, city: "—", state: "—", postal_code: "00000", country: "US" },
      },
    });

    const { data: ins } = await admin.from("issued_cards").insert({
      owner_id: userId,
      stripe_card_id: card.id,
      type: "physical",
      last4: card.last4,
      exp_month: card.exp_month,
      exp_year: card.exp_year,
      status: "inactive",
      shipping_status: card.shipping?.status ?? "pending",
    }).select().single();

    return json({ ok: true, card: ins });
  } catch (e) {
    console.error("request-physical-vet-card error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
