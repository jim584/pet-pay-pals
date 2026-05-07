import { supabase } from "@/integrations/supabase/client";

export type ReserveConsumptionRow = {
  id: string;
  ticket_id: string;
  amount_consumed: number;
  released: boolean;
  created_at: string;
  clinic_name: string | null;
  ticket_status: string | null;
};

export async function fetchMyReserveHistory(userId: string): Promise<ReserveConsumptionRow[]> {
  const { data: tickets, error: terr } = await supabase
    .from("vet_tickets")
    .select("id, clinic_name, status")
    .eq("owner_id", userId);
  if (terr) throw terr;
  const ids = (tickets ?? []).map((t: any) => t.id);
  if (ids.length === 0) return [];
  const ticketMap = new Map((tickets ?? []).map((t: any) => [t.id, t]));

  const { data, error } = await supabase
    .from("member_reserve_consumptions")
    .select("*")
    .in("ticket_id", ids)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c: any) => ({
    id: c.id,
    ticket_id: c.ticket_id,
    amount_consumed: Number(c.amount_consumed ?? 0),
    released: c.released,
    created_at: c.created_at,
    clinic_name: (ticketMap.get(c.ticket_id) as any)?.clinic_name ?? null,
    ticket_status: (ticketMap.get(c.ticket_id) as any)?.status ?? null,
  }));
}
