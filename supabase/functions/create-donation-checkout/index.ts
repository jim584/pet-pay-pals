import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { pet_id, amount, message, donor_name, donor_email } = body || {};

    const amt = Number(amount);
    if (!pet_id || !amt || amt <= 0) {
      return new Response(JSON.stringify({ error: "pet_id and positive amount required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: pet } = await admin.from("sponsorship_pets")
      .select("id, name, is_active").eq("id", pet_id).maybeSingle();
    if (!pet || !pet.is_active) {
      return new Response(JSON.stringify({ error: "Pet not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Optional auth
    let userId: string | null = null;
    let customerEmail: string | undefined = donor_email || undefined;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: u } = await userClient.auth.getUser();
      if (u?.user) {
        userId = u.user.id;
        customerEmail = customerEmail || u.user.email || undefined;
      }
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/") || "";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: customerEmail,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `Sponsor ${pet.name}`,
            description: message ? `Message: ${message}`.slice(0, 250) : undefined,
          },
          unit_amount: Math.round(amt * 100),
        },
        quantity: 1,
      }],
      metadata: {
        kind: "sponsorship_donation",
        pet_id,
        user_id: userId ?? "",
        message: (message ?? "").slice(0, 250),
        donor_name: (donor_name ?? "").slice(0, 100),
        donor_email: (donor_email ?? customerEmail ?? "").slice(0, 100),
      },
      success_url: `${origin}/help-overcome?donation=success`,
      cancel_url: `${origin}/help-overcome?donation=cancelled`,
    });

    return new Response(JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("create-donation-checkout error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
