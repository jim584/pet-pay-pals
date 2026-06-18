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
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = userData.user.id;
    const email = userData.user.email as string | undefined;

    const { ticket_id } = await req.json();
    if (!ticket_id) {
      return new Response(JSON.stringify({ error: "ticket_id required" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: ticket } = await admin.from("vet_tickets").select("*").eq("id", ticket_id).maybeSingle();
    if (!ticket || ticket.owner_id !== userId) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });
    }
    if (ticket.status !== "approved") {
      return new Response(JSON.stringify({ error: `Ticket status is ${ticket.status}` }), { status: 400, headers: corsHeaders });
    }
    const remainder = Number(ticket.coverage_breakdown?.member_remainder ?? 0);
    if (remainder <= 0) {
      return new Response(JSON.stringify({ error: "No member remainder due" }), { status: 400, headers: corsHeaders });
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
          unit_amount: Math.round(remainder * 100),
          product_data: { name: `Vet bill — ${ticket.clinic_name} (your portion)` },
        },
        quantity: 1,
      }],
      metadata: { vet_ticket_id: ticket_id, kind: "vet_ticket_remainder" },
      success_url: `${origin}/dashboard/vet-tickets?paid=${ticket_id}`,
      cancel_url: `${origin}/dashboard/vet-tickets?cancelled=${ticket_id}`,
    });

    await admin.from("vet_tickets").update({
      member_remainder_stripe_session_id: session.id,
    }).eq("id", ticket_id);

    return new Response(JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("collect-member-remainder error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
