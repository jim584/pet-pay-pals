import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

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
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = userData.user.id;

    const { ticket_id, amount, success_url, cancel_url } = await req.json();
    const amt = Number(amount);
    if (!ticket_id || !amt || amt < 1) {
      return new Response(JSON.stringify({ error: "ticket_id and amount required" }),
        { status: 400, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify ticket ownership and surface existing open obligations
    const { data: ticket } = await admin.from("vet_tickets")
      .select("id, owner_id, clinic_name").eq("id", ticket_id).maybeSingle();
    if (!ticket || ticket.owner_id !== userId) {
      return new Response(JSON.stringify({ error: "Ticket not found" }),
        { status: 404, headers: corsHeaders });
    }

    const { data: openOb } = await admin.from("bnpl_obligations")
      .select("id, outstanding_amount, provider")
      .eq("owner_id", userId)
      .in("status", ["pending", "active"]);
    const openSummary = {
      count: openOb?.length ?? 0,
      outstanding: (openOb ?? []).reduce((s, o: any) => s + Number(o.outstanding_amount ?? 0), 0),
    };

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    const origin = req.headers.get("origin") ?? "https://prowebbuilders.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "affirm", "klarna", "afterpay_clearpay"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `Vet bill remainder — ${ticket.clinic_name}` },
          unit_amount: Math.round(amt * 100),
        },
        quantity: 1,
      }],
      success_url: success_url ?? `${origin}/dashboard/payment-plans?bnpl=success`,
      cancel_url: cancel_url ?? `${origin}/dashboard/payment-plans?bnpl=cancel`,
      metadata: { ticket_id, user_id: userId, kind: "bnpl_remainder" },
    });

    return new Response(JSON.stringify({ url: session.url, session_id: session.id, open_summary: openSummary }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("create-bnpl-checkout error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: corsHeaders });
  }
});
