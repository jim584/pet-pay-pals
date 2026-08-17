import { supabase } from "@/integrations/supabase/client";
import type { AttestationValues } from "@/lib/attestation-schema";

export type AttestationRecord = {
  id: string;
  ticket_id: string | null;
  pet_id: string | null;
  owner_id: string;
  pet_name: string | null;
  clinic_name: string | null;
  vet_legal_name: string | null;
  signature_typed_name: string | null;
  signed_date: string | null;
  method: string;
  status: string;
  pdf_url: string | null;
  completed_at: string | null;
  created_at: string;
};

export async function submitAttestation(args: {
  values: AttestationValues;
  pet_id?: string | null;
  vet_profile_id?: string | null;
  attestation_id?: string | null;
  token?: string | null;
}): Promise<{ attestation_id: string; pdf_url: string }> {
  const { data, error } = await supabase.functions.invoke("submit-attestation", { body: args });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { attestation_id: data.attestation_id, pdf_url: data.pdf_url };
}

export async function sendAttestationRequest(args: {
  clinic_email: string;
  pet_id?: string | null;
  vet_profile_id?: string | null;
  prefill?: Record<string, unknown>;
}): Promise<{ attestation_id: string; link: string; emailed: boolean }> {
  const { data, error } = await supabase.functions.invoke("send-attestation-request", {
    body: { ...args, site_url: window.location.origin },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { attestation_id: data.attestation_id, link: data.link, emailed: !!data.emailed };
}

export async function getAttestationByToken(token: string): Promise<{
  member_name: string | null;
  expires_at: string;
  prefill: Partial<AttestationValues>;
}> {
  const { data, error } = await supabase.functions.invoke("attestation-by-token", { body: { token } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function listMyCompletedAttestations(userId: string): Promise<AttestationRecord[]> {
  const { data, error } = await supabase
    .from("vet_attestations" as never)
    .select("*")
    .eq("owner_id", userId)
    .eq("status", "completed")
    .is("ticket_id", null)
    .order("completed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AttestationRecord[];
}
