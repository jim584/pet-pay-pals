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
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;
    const email = claims.claims.email as string | undefined;

    const body = await req.json();
    const { plan_id, pet_id, billing_interval = "month", is_fear_free_member = false } = body || {};
    if (!plan_id) {
      return new Response(JSON.stringify({ error: "plan_id required" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: plan, error: planErr } = await admin
      .from("membership_plans").select("*").eq("id", plan_id).single();
    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), { status: 404, headers: corsHeaders });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

    // Get or create Stripe customer
    const { data: profile } = await admin.from("profiles").select("stripe_customer_id, full_name").eq("user_id", userId).single();
    let customerId = profile?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({ email, name: profile?.full_name || undefined, metadata: { user_id: userId } });
      customerId = customer.id;
      await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("user_id", userId);
    }

    // Compute pricing (cents). Fear Free 5% applies only to membership.
    const isAnnual = billing_interval === "year";
    const interval: "month" | "year" = isAnnual ? "year" : "month";

    const baseMembership = isAnnual ? Number(plan.annual_price) : Number(plan.membership_fee);
    const ffDiscountedMembership = isAnnual
      ? Number(plan.fear_free_member_charge) * 12
      : Number(plan.fear_free_member_charge);
    const membershipAmount = is_fear_free_member ? ffDiscountedMembership : baseMembership;
    const platformAmount = isAnnual ? Number(plan.platform_fee) * 12 : Number(plan.platform_fee);

    const origin = req.headers.get("origin") || "https://example.com";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            recurring: { interval },
            unit_amount: Math.round(membershipAmount * 100),
            product_data: { name: `${plan.tier_label} (${plan.species}) — Membership${is_fear_free_member ? " (Fear Free)" : ""}` },
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            recurring: { interval },
            unit_amount: Math.round(platformAmount * 100),
            product_data: { name: "Platform Fee" },
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id: userId,
        plan_id: plan.id,
        plan_code: plan.plan_code,
        pet_id: pet_id ?? "",
        billing_interval: interval,
        is_fear_free_member: String(!!is_fear_free_member),
      },
      success_url: `${origin}/dashboard/wallet?subscription=success`,
      cancel_url: `${origin}/plans?cancelled=1`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-checkout error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
