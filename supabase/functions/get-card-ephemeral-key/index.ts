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
    const { data: userData, error: userErr } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { card_id, nonce } = await req.json();
    if (!card_id) return json({ error: "card_id required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: card } = await admin.from("issued_cards")
      .select("owner_id").eq("stripe_card_id", card_id).maybeSingle();
    if (!card || card.owner_id !== userId) return json({ error: "Forbidden" }, 403);

    const ISSUING_ENABLED = (Deno.env.get("ISSUING_ENABLED") ?? "false").toLowerCase() === "true";
    if (!ISSUING_ENABLED) return json({ error: "Issuing not enabled" }, 503);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    const key = await stripe.ephemeralKeys.create(
      { issuing_card: card_id, nonce },
      { apiVersion: "2024-06-20" } as any,
    );
    return json({ ephemeralKeySecret: key.secret });
  } catch (e) {
    console.error("get-card-ephemeral-key error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
