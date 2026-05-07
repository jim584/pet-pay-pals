import { supabase } from "@/integrations/supabase/client";

export type TicketMessageRole = "owner" | "vet" | "admin";

export type TicketAttachment = {
  path: string;
  name: string;
  size: number;
  content_type: string | null;
};

export type TicketMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: TicketMessageRole;
  body: string;
  attachments: TicketAttachment[];
  read_by_owner: boolean;
  read_by_vet: boolean;
  read_by_admin: boolean;
  created_at: string;
  sender_name?: string | null;
};

export async function listTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  const { data, error } = await supabase
    .from("vet_ticket_messages" as any)
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const msgs = (data ?? []).map((m: any) => ({
    ...m,
    attachments: Array.isArray(m.attachments) ? m.attachments : [],
  })) as TicketMessage[];
  const senderIds = Array.from(new Set(msgs.map((m) => m.sender_id)));
  if (senderIds.length === 0) return msgs;
  const { data: profs } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", senderIds);
  const map = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name as string]));
  return msgs.map((m) => ({ ...m, sender_name: map.get(m.sender_id) ?? null }));
}

export async function uploadMessageAttachment(ticketId: string, file: File): Promise<TicketAttachment> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `messages/${ticketId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const { error } = await supabase.storage.from("vet-tickets").upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return { path, name: file.name, size: file.size, content_type: file.type || null };
}

export async function getMessageAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("vet-tickets").createSignedUrl(path, 60 * 30);
  if (error) throw error;
  return data.signedUrl;
}

export async function sendTicketMessage(
  ticketId: string,
  body: string,
  attachments: TicketAttachment[] = [],
): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed && attachments.length === 0) return;
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { error } = await supabase.from("vet_ticket_messages" as any).insert({
    ticket_id: ticketId,
    sender_id: uid,
    sender_role: "owner", // overridden by trigger
    body: trimmed || "(attachment)",
    attachments: attachments as any,
  } as any);
  if (error) throw error;
}

export async function markTicketMessagesRead(ticketId: string, role: TicketMessageRole): Promise<void> {
  const col =
    role === "owner" ? "read_by_owner" : role === "vet" ? "read_by_vet" : "read_by_admin";
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return;
  await supabase
    .from("vet_ticket_messages" as any)
    .update({ [col]: true } as any)
    .eq("ticket_id", ticketId)
    .eq(col, false)
    .neq("sender_id", uid);
}

export async function getTicketUnreadCount(ticketId: string, role: TicketMessageRole): Promise<number> {
  const col =
    role === "owner" ? "read_by_owner" : role === "vet" ? "read_by_vet" : "read_by_admin";
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return 0;
  const { count, error } = await supabase
    .from("vet_ticket_messages" as any)
    .select("id", { count: "exact", head: true })
    .eq("ticket_id", ticketId)
    .eq(col, false)
    .neq("sender_id", uid);
  if (error) return 0;
  return count ?? 0;
}

export function subscribeToTicketMessages(ticketId: string, onChange: () => void) {
  const channel = supabase
    .channel(`vet-ticket-msgs-${ticketId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "vet_ticket_messages", filter: `ticket_id=eq.${ticketId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
