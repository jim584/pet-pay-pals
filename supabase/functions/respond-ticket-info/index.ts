import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const ticketId = typeof body?.ticket_id === "string" ? body.ticket_id : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const documentUrl = typeof body?.document_url === "string" ? body.document_url.trim() : "";
    if (!ticketId || (message.length < 3 && !documentUrl)) {
      return new Response(
        JSON.stringify({ error: "ticket_id and a message or an uploaded document are required" }),
        { status: 400, headers: corsHeaders }
      );
    }
    if (message.length > 2000) {
      return new Response(JSON.stringify({ error: "Message is too long" }), { status: 400, headers: corsHeaders });
    }

    const { data: ticket } = await admin
      .from("vet_tickets")
      .select("id,status,owner_id,vet_profile_id,estimate_url")
      .eq("id", ticketId)
      .maybeSingle();
    if (!ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), { status: 404, headers: corsHeaders });
    }

    let allowed = ticket.owner_id === userId;
    if (!allowed && ticket.vet_profile_id) {
      const { data: vp } = await admin.from("vet_profiles").select("id").eq("id", ticket.vet_profile_id).eq("user_id", userId).maybeSingle();
      allowed = !!vp;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    if (ticket.status !== "needs_info") {
      return new Response(JSON.stringify({ error: "This ticket is not awaiting additional information" }), { status: 400, headers: corsHeaders });
    }

    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = {
      status: "under_review",
      info_response_message: message || "(document uploaded)",
      info_responded_at: nowIso,
    };
    if (documentUrl) update.estimate_url = documentUrl;

    const { error: updErr } = await admin.from("vet_tickets").update(update).eq("id", ticketId);
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: corsHeaders });
    }

    await admin.from("vet_ticket_messages").insert({
      ticket_id: ticketId,
      sender_id: userId,
      sender_role: ticket.owner_id === userId ? "owner" : "vet",
      body: message || "Uploaded the requested document.",
      attachments: documentUrl ? [{ url: documentUrl, kind: "document" }] : [],
    });

    return new Response(JSON.stringify({ ok: true, status: "under_review" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("respond-ticket-info error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
