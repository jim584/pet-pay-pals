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

    const body = await req.json().catch(() => ({}));
    const sessionId = (body?.session_id ?? "").toString();
    if (!sessionId.startsWith("cs_")) {
      return new Response(JSON.stringify({ error: "Missing session_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["setup_intent"] });

    const md = (session.metadata ?? {}) as Record<string, string>;
    if (md.kind !== "bnpl_autopay_setup" || md.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Session does not belong to this user" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const si = typeof session.setup_intent === "string"
      ? await stripe.setupIntents.retrieve(session.setup_intent)
      : session.setup_intent as Stripe.SetupIntent | null;
    const pmId = si?.payment_method
      ? (typeof si.payment_method === "string" ? si.payment_method : si.payment_method.id)
      : null;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

    if (!pmId) {
      return new Response(JSON.stringify({ default_payment_method_id: null, status: session.status ?? "incomplete" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (customerId) {
      try {
        await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pmId } });
      } catch (e) { console.error("set customer default pm failed:", e); }
    }
    await admin.from("profiles").update({ default_payment_method_id: pmId }).eq("user_id", user.id);

    return new Response(JSON.stringify({ default_payment_method_id: pmId, status: "complete" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("confirm-bnpl-autopay error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
