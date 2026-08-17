import { supabase } from "@/integrations/supabase/client";

export type VetAccountStatus = "pending_verification" | "verified" | "rejected";

export interface VetAccountInfo {
  id: string;
  user_id: string;
  clinic_name: string;
  account_status: VetAccountStatus;
  first_name: string | null;
  last_name: string | null;
  merchant_id: string | null;
  identity_photo_path: string | null;
  identity_photo_captured_at: string | null;
  account_rejection_reason: string | null;
}

/** Current signed-in user's vet account/verification state (null if not a vet). */
export async function fetchVetAccount(userId: string): Promise<VetAccountInfo | null> {
  const { data, error } = await supabase
    .from("vet_profiles")
    .select(
      "id, user_id, clinic_name, account_status, first_name, last_name, merchant_id, identity_photo_path, identity_photo_captured_at, account_rejection_reason",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as VetAccountInfo) ?? null;
}

export interface VetSignupPayload {
  first_name: string;
  last_name: string;
  license_number: string;
  license_state: string;
  merchant_id: string;
  license_record_id?: string | null;
  license_matched: boolean;
}

/**
 * Creates the vet role + profile for a freshly signed-up user.
 * The DB guard forces account_status = pending_verification and blocks
 * self-set verification fields, so nothing here can grant vet powers.
 */
export async function createVetAccount(userId: string, payload: VetSignupPayload) {
  const { error: roleErr } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role: "vet" });
  if (roleErr && roleErr.code !== "23505") throw roleErr;

  const fullName = `${payload.first_name} ${payload.last_name}`.trim();
  const { data, error } = await supabase
    .from("vet_profiles")
    .insert({
      user_id: userId,
      clinic_name: fullName ? `Dr. ${fullName}` : "New clinic",
      first_name: payload.first_name,
      last_name: payload.last_name,
      license_number: payload.license_number.toUpperCase().trim(),
      license_state: payload.license_state,
      license_full_legal_name: fullName,
      merchant_id: payload.merchant_id || null,
      specializations: [],
    } as never)
    .select()
    .single();
  if (error) throw error;

  // Kick off the automated license check; the match snapshot is written
  // server-side (it is an admin-guarded column).
  await supabase.functions
    .invoke("verify-vet-license", { body: { vet_profile_id: (data as { id: string }).id } })
    .catch(() => undefined);

  return data as unknown as { id: string };
}

/** Sends the captured JPEG (data URL) for storage + manual review. */
export async function submitIdentityPhoto(dataUrl: string, token?: string) {
  const { data, error } = await supabase.functions.invoke("submit-vet-identity", {
    body: { photo_base64: dataUrl, token: token ?? undefined },
  });
  if (error) throw error;
  return data as { ok: boolean };
}

/** Emails a one-time link so a desktop user can capture the photo on their phone. */
export async function sendIdentityPhoneLink() {
  const { data, error } = await supabase.functions.invoke("send-vet-identity-link", {
    body: { site_url: window.location.origin },
  });
  if (error) throw error;
  return data as { ok: boolean; emailed: boolean; link: string };
}
