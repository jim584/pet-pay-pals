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
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = user.id;
    const email = user.email ?? undefined;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await admin.from("profiles")
      .select("stripe_customer_id, full_name, default_payment_method_id")
      .eq("user_id", userId).single();

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    let customerId = profile?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const c = await stripe.customers.create({
        email, name: profile?.full_name || undefined, metadata: { user_id: userId },
      });
      customerId = c.id;
      await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("user_id", userId);
    }

    // Use a Checkout Session in setup mode for hosted, no-elements UX
    const origin = req.headers.get("origin") || "https://example.com";
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      payment_method_types: ["card"],
      success_url: `${origin}/dashboard/payment-plans?autopay=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/payment-plans?autopay=cancelled`,
      metadata: { kind: "bnpl_autopay_setup", user_id: userId },
    });

    return new Response(JSON.stringify({
      url: session.url,
      current_payment_method_id: profile?.default_payment_method_id ?? null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("setup-bnpl-autopay error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
