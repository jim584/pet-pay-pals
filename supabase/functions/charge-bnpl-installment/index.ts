import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Internal-only: callable with the service role key.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (token !== serviceKey) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const installmentId: string | undefined = body.installment_id;
    if (!installmentId) {
      return new Response(JSON.stringify({ error: "installment_id required" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const { data: inst } = await admin.from("bnpl_installments")
      .select("id, obligation_id, amount, paid_amount, status, auto_charge_attempts, seq")
      .eq("id", installmentId).maybeSingle();
    if (!inst) return new Response(JSON.stringify({ error: "Installment not found" }), { status: 404, headers: corsHeaders });
    if (inst.status === "paid") {
      return new Response(JSON.stringify({ skipped: "already_paid" }), { status: 200, headers: corsHeaders });
    }

    const { data: ob } = await admin.from("bnpl_obligations")
      .select("id, owner_id, status, auto_pay_enabled")
      .eq("id", inst.obligation_id).maybeSingle();
    if (!ob || !ob.auto_pay_enabled || !["pending", "active"].includes(ob.status)) {
      return new Response(JSON.stringify({ skipped: "obligation_not_chargeable" }), { status: 200, headers: corsHeaders });
    }

    const { data: profile } = await admin.from("profiles")
      .select("stripe_customer_id, default_payment_method_id")
      .eq("user_id", ob.owner_id).single();

    if (!profile?.stripe_customer_id || !profile?.default_payment_method_id) {
      return new Response(JSON.stringify({ skipped: "no_payment_method" }), { status: 200, headers: corsHeaders });
    }

    const owe = +(Number(inst.amount) - Number(inst.paid_amount ?? 0)).toFixed(2);
    if (owe <= 0) {
      return new Response(JSON.stringify({ skipped: "nothing_to_pay" }), { status: 200, headers: corsHeaders });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

    // mark attempt before
    await admin.from("bnpl_installments").update({
      auto_charge_attempts: (inst.auto_charge_attempts ?? 0) + 1,
      last_auto_charge_at: new Date().toISOString(),
    }).eq("id", inst.id);

    try {
      const pi = await stripe.paymentIntents.create({
        amount: Math.round(owe * 100),
        currency: "usd",
        customer: profile.stripe_customer_id,
        payment_method: profile.default_payment_method_id,
        off_session: true,
        confirm: true,
        description: `BNPL installment ${inst.seq}`,
        metadata: {
          kind: "bnpl_payment",
          obligation_id: ob.id,
          installment_id: inst.id,
          pay_full: "false",
          user_id: ob.owner_id,
          source: "autopay",
        },
      });
      await admin.from("bnpl_installments")
        .update({ last_auto_charge_error: null })
        .eq("id", inst.id);
      return new Response(JSON.stringify({ ok: true, payment_intent_id: pi.id, status: pi.status }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      const code = err?.code ?? err?.raw?.code ?? null;
      await admin.from("bnpl_installments")
        .update({ last_auto_charge_error: code ? `${code}: ${msg}` : msg })
        .eq("id", inst.id);
      return new Response(JSON.stringify({ ok: false, error: msg, code }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("charge-bnpl-installment error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
