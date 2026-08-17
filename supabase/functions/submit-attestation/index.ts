import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildAttestationPdf } from "../_shared/attestation-pdf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const FIELDS = [
  "pet_name", "pet_age_or_dob", "pet_type", "pet_type_other", "breed", "primary_breed",
  "pet_status", "clinic_name", "clinic_street", "clinic_city", "clinic_state", "clinic_zip",
  "vet_legal_name", "license_state", "license_number", "merchant_id", "processor",
];

function validate(v: Record<string, any>): string | null {
  const a = v.answers ?? {};
  if (!v.pet_name) return "Pet name is required";
  if (!v.pet_type) return "Pet type is required";
  if (!v.clinic_name) return "Clinic name is required";
  if (!v.clinic_city || !v.clinic_state || !v.clinic_zip) return "Clinic city, state and ZIP are required";
  if (!v.vet_legal_name) return "Veterinarian legal name is required";
  if (!v.license_state || !v.license_number) return "License state and number are required";
  if (!v.no_traditional_mid && !v.merchant_id) return "Merchant ID is required unless no traditional MID was issued";
  if (!(a.records_attached ?? []).length) return "Indicate which records are attached";
  if (!(a.service_types ?? []).length) return "Select the types of services";
  if (!a.service_status) return "Service status is required";
  if (!a.necropsy) return "Necropsy answer is required";
  if (!a.necropsy_only) {
    if (!a.diagnosis || !a.prognosis || !a.latest_start || !a.likely_result) {
      return "All clinical fact answers are required";
    }
  }
  if (!a.preventable || !a.cosmetic) return "Both eligibility answers are required";
  if (v.certified !== true) return "The certification must be accepted";
  if (!v.signature_typed_name || String(v.signature_typed_name).trim().length < 3) {
    return "Type the veterinarian's full legal name to sign";
  }
  if (!v.signed_date) return "Date signed is required";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const values = (body?.values ?? {}) as Record<string, any>;
    const token = typeof body?.token === "string" ? body.token : "";

    let ownerId: string | null = null;
    let attestationId: string | null = typeof body?.attestation_id === "string" ? body.attestation_id : null;
    let tokenRow: any = null;
    let method = "in_clinic";
    let petId: string | null = typeof body?.pet_id === "string" ? body.pet_id : null;
    let vetProfileId: string | null = typeof body?.vet_profile_id === "string" ? body.vet_profile_id : null;

    if (token) {
      const hash = await sha256(token);
      const { data: t } = await admin.from("attestation_link_tokens")
        .select("*").eq("token_hash", hash).maybeSingle();
      if (!t) return json({ error: "This link is not valid" }, 401);
      if (t.used_at) return json({ error: "This link has already been used" }, 410);
      if (new Date(t.expires_at).getTime() < Date.now()) return json({ error: "This link has expired" }, 410);
      tokenRow = t;
      attestationId = t.attestation_id;
      method = "emailed_link";
      const { data: existing } = await admin.from("vet_attestations")
        .select("owner_id, pet_id, vet_profile_id, ticket_id, status").eq("id", attestationId).maybeSingle();
      if (!existing) return json({ error: "Attestation not found" }, 404);
      if (existing.status === "completed") return json({ error: "This attestation is already complete" }, 410);
      ownerId = existing.owner_id;
      petId = existing.pet_id;
      vetProfileId = existing.vet_profile_id;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const anon = createClient(
        Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: userData, error: userErr } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
      if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
      ownerId = userData.user.id;
      if (attestationId) {
        const { data: existing } = await admin.from("vet_attestations")
          .select("owner_id, status").eq("id", attestationId).maybeSingle();
        if (!existing || existing.owner_id !== ownerId) return json({ error: "Forbidden" }, 403);
        if (existing.status === "completed") return json({ error: "This attestation is already complete" }, 410);
      }
    }

    const invalid = validate(values);
    if (invalid) return json({ error: invalid }, 400);

    const record: Record<string, any> = {
      owner_id: ownerId,
      pet_id: petId,
      vet_profile_id: vetProfileId,
      answers: values.answers ?? {},
      no_traditional_mid: values.no_traditional_mid === true,
      date_of_death: values.pet_status === "deceased" && values.date_of_death ? values.date_of_death : null,
      certified: true,
      signature_typed_name: String(values.signature_typed_name).trim(),
      signed_date: values.signed_date,
      method,
      status: "completed",
      completed_at: new Date().toISOString(),
    };
    for (const f of FIELDS) record[f] = values[f] ?? null;

    let saved: any;
    if (attestationId) {
      const { data, error } = await admin.from("vet_attestations")
        .update(record).eq("id", attestationId).select().single();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await admin.from("vet_attestations").insert(record).select().single();
      if (error) throw error;
      saved = data;
    }

    const pdfBytes = await buildAttestationPdf(saved, saved.ticket_id);
    const path = `${ownerId}/${Date.now()}-attestation-${saved.id}.pdf`;
    const { error: upErr } = await admin.storage.from("vet-tickets")
      .upload(path, pdfBytes, { contentType: "application/pdf", upsert: false });
    if (upErr) throw upErr;

    await admin.from("vet_attestations").update({ pdf_url: path }).eq("id", saved.id);
    if (saved.ticket_id) {
      await admin.from("vet_tickets").update({ attestation_url: path }).eq("id", saved.ticket_id);
    }
    if (tokenRow) {
      await admin.from("attestation_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", tokenRow.id);
    }

    return json({ ok: true, attestation_id: saved.id, pdf_url: path });
  } catch (e) {
    console.error("submit-attestation error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
