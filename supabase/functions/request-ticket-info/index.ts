import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PENDING = ["submitted", "under_review", "awaiting_secondary_review", "needs_info"];

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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", userId);
    if (!(roleRows ?? []).some((r: any) => r.role === "admin")) {
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const ticketId = typeof body?.ticket_id === "string" ? body.ticket_id : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!ticketId || message.length < 5 || message.length > 2000) {
      return new Response(
        JSON.stringify({ error: "ticket_id and a message between 5 and 2000 characters are required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { data: ticket } = await admin.from("vet_tickets").select("id,status").eq("id", ticketId).maybeSingle();
    if (!ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), { status: 404, headers: corsHeaders });
    }
    if (!PENDING.includes(ticket.status)) {
      return new Response(JSON.stringify({ error: `Cannot request info on a ${ticket.status} ticket` }), { status: 400, headers: corsHeaders });
    }

    const nowIso = new Date().toISOString();
    const { error: updErr } = await admin.from("vet_tickets").update({
      status: "needs_info",
      info_request_message: message,
      info_requested_at: nowIso,
      info_requested_by: userId,
      info_response_message: null,
      info_responded_at: null,
    }).eq("id", ticketId);
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: corsHeaders });
    }

    await admin.from("vet_ticket_messages").insert({
      ticket_id: ticketId,
      sender_id: userId,
      sender_role: "admin",
      body: `Information requested: ${message}`,
      read_by_admin: true,
    });

    return new Response(JSON.stringify({ ok: true, status: "needs_info" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("request-ticket-info error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
