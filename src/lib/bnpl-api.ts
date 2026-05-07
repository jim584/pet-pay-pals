import { supabase } from "@/integrations/supabase/client";

export type BnplObligationStatus = "pending" | "active" | "paid_off" | "defaulted" | "cancelled";

export interface MyObligation {
  id: string;
  ticket_id: string;
  pet_id: string;
  status: BnplObligationStatus;
  original_amount: number;
  outstanding_amount: number;
  installment_count: number;
  installment_interval_days: number;
  next_due_date: string | null;
  default_at: string | null;
  created_at: string;
  auto_pay_enabled?: boolean;
  clinic_name?: string | null;
  estimate_amount?: number | null;
}

export interface MyInstallment {
  id: string;
  obligation_id: string;
  seq: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: "scheduled" | "due" | "paid" | "missed";
  paid_at: string | null;
}

export async function listMyObligations(userId: string): Promise<MyObligation[]> {
  const { data, error } = await supabase
    .from("bnpl_obligations")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  if (!rows.length) return [];
  const ticketIds = Array.from(new Set(rows.map((r) => r.ticket_id).filter(Boolean)));
  const { data: tickets } = await supabase
    .from("vet_tickets")
    .select("id, clinic_name, estimate_amount")
    .in("id", ticketIds);
  const byId = new Map((tickets ?? []).map((t: any) => [t.id, t]));
  return rows.map((r) => ({
    ...r,
    clinic_name: byId.get(r.ticket_id)?.clinic_name ?? null,
    estimate_amount: byId.get(r.ticket_id)?.estimate_amount ?? null,
  })) as MyObligation[];
}

export async function listInstallments(obligationId: string): Promise<MyInstallment[]> {
  const { data, error } = await supabase
    .from("bnpl_installments")
    .select("*")
    .eq("obligation_id", obligationId)
    .order("seq", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MyInstallment[];
}

export async function startInstallmentCheckout(args: {
  obligation_id: string;
  installment_id?: string;
  pay_full?: boolean;
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke("pay-bnpl-installment", { body: args });
  if (error) throw error;
  if (!data?.url) throw new Error("No checkout URL returned");
  return data.url as string;
}

export async function startAutopaySetup(): Promise<{ url: string; current_payment_method_id: string | null }> {
  const { data, error } = await supabase.functions.invoke("setup-bnpl-autopay", { body: {} });
  if (error) throw error;
  if (!data?.url) throw new Error("No setup URL returned");
  return data;
}

export async function confirmAutopaySetup(sessionId: string): Promise<{ default_payment_method_id: string | null; status: string }> {
  const { data, error } = await supabase.functions.invoke("confirm-bnpl-autopay", { body: { session_id: sessionId } });
  if (error) throw error;
  return data;
}

export async function setObligationAutopay(obligationId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from("bnpl_obligations")
    .update({ auto_pay_enabled: enabled })
    .eq("id", obligationId);
  if (error) throw error;
}

export async function getAutopayStatus(userId: string): Promise<{ default_payment_method_id: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("default_payment_method_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return { default_payment_method_id: (data as any)?.default_payment_method_id ?? null };
}
