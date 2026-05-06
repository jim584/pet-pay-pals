import { supabase } from "@/integrations/supabase/client";

export type VetTicketStatus =
  | "submitted" | "under_review" | "approved" | "rejected"
  | "funded" | "card_issued" | "settled" | "expired" | "cancelled";

export type CoverageBreakdown = {
  estimate: number;
  plan_tier?: string;
  plan_year_cap?: number | null;
  plan_year_cap_remaining?: number | null;
  dp_window_months?: number | null;
  dp_available: number;
  dp_use: number;
  bnpl_capacity: number;
  bnpl_use: number;
  bnpl_existing_outstanding?: number;
  reserve_use: number;
  member_remainder: number;
  computed_at?: string;
};

export type VetTicket = {
  id: string;
  pet_id: string;
  owner_id: string;
  vet_profile_id: string | null;
  clinic_name: string;
  estimate_amount: number;
  estimate_url: string | null;
  attestation_url: string | null;
  notes: string | null;
  status: VetTicketStatus;
  coverage_breakdown: CoverageBreakdown | null;
  approved_amount: number | null;
  member_remainder_paid: boolean;
  admin_notes: string | null;
  rejection_reason: string | null;
  card_id: string | null;
  authorized_until: string | null;
  merchant_lock_type: string | null;
  issued_card_id: string | null;
  created_at: string;
  updated_at: string;
};

export type IssuedCard = {
  id: string;
  owner_id: string;
  stripe_card_id: string;
  type: "virtual" | "physical";
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  status: "active" | "inactive" | "canceled";
  shipping_status: string | null;
  created_at: string;
  updated_at: string;
};

export async function uploadTicketFile(userId: string, file: File, kind: "estimate" | "attestation"): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${userId}/${Date.now()}-${kind}.${ext}`;
  const { error } = await supabase.storage.from("vet-tickets").upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function getTicketFileSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("vet-tickets").createSignedUrl(path, 60 * 30);
  if (error) throw error;
  return data.signedUrl;
}

export async function submitVetTicket(args: {
  pet_id: string; clinic_name: string; estimate_amount: number;
  vet_profile_id?: string | null; estimate_url?: string | null;
  attestation_url?: string | null; notes?: string | null;
}): Promise<VetTicket> {
  const { data, error } = await supabase.functions.invoke("submit-vet-ticket", { body: args });
  if (error) throw error;
  return data.ticket as VetTicket;
}

export async function listMyTickets(userId: string): Promise<VetTicket[]> {
  const { data, error } = await supabase.from("vet_tickets")
    .select("*").eq("owner_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as VetTicket[];
}

export async function listTicketsForVet(vetProfileId: string): Promise<VetTicket[]> {
  const { data, error } = await supabase.from("vet_tickets")
    .select("*").eq("vet_profile_id", vetProfileId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as VetTicket[];
}

export async function listAllTicketsForAdmin(): Promise<VetTicket[]> {
  const { data, error } = await supabase.from("vet_tickets")
    .select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as VetTicket[];
}

export async function computeTicketCoverage(ticket_id: string): Promise<CoverageBreakdown> {
  const { data, error } = await supabase.functions.invoke("compute-ticket-coverage", { body: { ticket_id } });
  if (error) throw error;
  return data.breakdown as CoverageBreakdown;
}

export async function approveVetTicket(ticket_id: string, breakdown: CoverageBreakdown, admin_notes?: string) {
  const { data, error } = await supabase.functions.invoke("approve-vet-ticket",
    { body: { ticket_id, breakdown, admin_notes } });
  if (error) throw error;
  return data;
}

export async function rejectVetTicket(ticket_id: string, reason: string) {
  const { data, error } = await supabase.functions.invoke("reject-vet-ticket", { body: { ticket_id, reason } });
  if (error) throw error;
  return data;
}

export async function startMemberRemainderCheckout(ticket_id: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("collect-member-remainder", { body: { ticket_id } });
  if (error) throw error;
  if (!data?.url) throw new Error("No checkout URL returned");
  return data.url as string;
}

export async function getTicket(ticket_id: string): Promise<VetTicket | null> {
  const { data, error } = await supabase.from("vet_tickets").select("*").eq("id", ticket_id).maybeSingle();
  if (error) throw error;
  return (data as unknown as VetTicket) ?? null;
}

export async function getMyIssuedCards(userId: string): Promise<IssuedCard[]> {
  const { data, error } = await supabase.from("issued_cards")
    .select("*").eq("owner_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as IssuedCard[];
}

export async function requestPhysicalCard(): Promise<IssuedCard> {
  const { data, error } = await supabase.functions.invoke("request-physical-vet-card", { body: {} });
  if (error) throw error;
  return data.card as IssuedCard;
}

export async function getCardEphemeralKey(card_id: string, nonce?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("get-card-ephemeral-key",
    { body: { card_id, nonce } });
  if (error) throw error;
  return data.ephemeralKeySecret as string;
}
