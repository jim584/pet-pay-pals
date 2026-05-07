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
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;
    const email = claims.claims.email as string | undefined;

    const body = await req.json().catch(() => ({}));
    const obligationId: string | undefined = body.obligation_id;
    const installmentId: string | undefined = body.installment_id;
    const payFull: boolean = body.pay_full === true;
    if (!obligationId) {
      return new Response(JSON.stringify({ error: "obligation_id required" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: ob } = await admin.from("bnpl_obligations").select("*").eq("id", obligationId).maybeSingle();
    if (!ob || ob.owner_id !== userId) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });
    }
    if (!["pending", "active", "defaulted"].includes(ob.status)) {
      return new Response(JSON.stringify({ error: `Obligation status ${ob.status}` }), { status: 400, headers: corsHeaders });
    }

    let amount = 0;
    let label = "";
    if (payFull) {
      amount = Number(ob.outstanding_amount);
      label = `Payment plan balance — ${ob.id.slice(0, 8)}`;
    } else {
      if (!installmentId) {
        return new Response(JSON.stringify({ error: "installment_id required" }), { status: 400, headers: corsHeaders });
      }
      const { data: inst } = await admin.from("bnpl_installments")
        .select("*").eq("id", installmentId).eq("obligation_id", obligationId).maybeSingle();
      if (!inst) return new Response(JSON.stringify({ error: "Installment not found" }), { status: 404, headers: corsHeaders });
      if (inst.status === "paid") {
        return new Response(JSON.stringify({ error: "Installment already paid" }), { status: 400, headers: corsHeaders });
      }
      amount = +(Number(inst.amount) - Number(inst.paid_amount ?? 0)).toFixed(2);
      label = `Payment plan installment ${inst.seq}`;
    }
    if (amount <= 0) {
      return new Response(JSON.stringify({ error: "Nothing to pay" }), { status: 400, headers: corsHeaders });
    }

    const { data: profile } = await admin.from("profiles")
      .select("stripe_customer_id, full_name").eq("user_id", userId).single();
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    let customerId = profile?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const c = await stripe.customers.create({ email, name: profile?.full_name || undefined, metadata: { user_id: userId } });
      customerId = c.id;
      await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("user_id", userId);
    }

    const origin = req.headers.get("origin") || "https://example.com";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: Math.round(amount * 100),
          product_data: { name: label },
        },
        quantity: 1,
      }],
      metadata: {
        kind: "bnpl_payment",
        obligation_id: obligationId,
        installment_id: installmentId ?? "",
        pay_full: payFull ? "true" : "false",
        user_id: userId,
      },
      success_url: `${origin}/dashboard/payment-plans?paid=${obligationId}`,
      cancel_url: `${origin}/dashboard/payment-plans?cancelled=${obligationId}`,
    });

    await admin.from("bnpl_obligations")
      .update({ last_payment_attempt_at: new Date().toISOString() })
      .eq("id", obligationId);

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pay-bnpl-installment error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
