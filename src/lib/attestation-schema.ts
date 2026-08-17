// Shared definition of the Veterinarian Attestation form.
// Mirrors the printed "HELP A PET TOGETHER — VETERINARIAN ATTESTATION" form.

export type AttestationAnswers = {
  necropsy_only?: boolean;
  records_attached?: string[];
  service_types?: string[];
  service_status?: string;
  necropsy?: string;
  mixed_visit_notes?: string;
  diagnosis?: string;
  prognosis?: string;
  latest_start?: string;
  likely_result?: string;
  preventable?: string;
  cosmetic?: string;
};

export type AttestationValues = {
  pet_name: string;
  pet_age_or_dob: string;
  pet_type: string;
  pet_type_other: string;
  breed: string;
  primary_breed: string;
  pet_status: string;
  date_of_death: string;
  clinic_name: string;
  clinic_street: string;
  clinic_city: string;
  clinic_state: string;
  clinic_zip: string;
  vet_legal_name: string;
  license_state: string;
  license_number: string;
  merchant_id: string;
  processor: string;
  no_traditional_mid: boolean;
  answers: AttestationAnswers;
  certified: boolean;
  signature_typed_name: string;
  signed_date: string;
};

export const emptyAttestation = (): AttestationValues => ({
  pet_name: "", pet_age_or_dob: "", pet_type: "", pet_type_other: "",
  breed: "", primary_breed: "", pet_status: "alive", date_of_death: "",
  clinic_name: "", clinic_street: "", clinic_city: "", clinic_state: "", clinic_zip: "",
  vet_legal_name: "", license_state: "", license_number: "",
  merchant_id: "", processor: "", no_traditional_mid: false,
  answers: { records_attached: [], service_types: [] },
  certified: false, signature_typed_name: "",
  signed_date: new Date().toISOString().slice(0, 10),
});

export const PET_TYPES = [
  { value: "dog", label: "Dog" },
  { value: "cat", label: "Cat" },
  { value: "other", label: "Other" },
];

export const RECORDS_ATTACHED = [
  { value: "estimate_invoice", label: "Itemized estimate and/or invoice" },
  { value: "chart_note", label: "Current chart note or discharge summary" },
  { value: "other_records", label: "Relevant labs, imaging, specialist, preventive, behavior, or emotional-wellbeing records" },
];

export const SERVICE_TYPES = [
  { value: "illness", label: "Illness, injury, or related diagnostics/treatment" },
  { value: "routine", label: "Routine, preventive, or planned care, including elective spay/neuter" },
  { value: "end_of_life", label: "End-of-life or postmortem service, including hospice, euthanasia, or necropsy" },
];

export const SERVICE_STATUS = [
  { value: "proposed", label: "Proposed or estimated" },
  { value: "completed", label: "Completed or invoiced" },
  { value: "both", label: "Both" },
];

export const NECROPSY = [
  { value: "not_included", label: "Not included" },
  { value: "proposed", label: "Proposed or scheduled" },
  { value: "completed", label: "Completed" },
];

export const DIAGNOSIS = [
  { value: "confirmed", label: "Confirmed" },
  { value: "suspected", label: "Suspected" },
  { value: "undetermined", label: "Not yet determined" },
];

export const PROGNOSIS = [
  { value: "favorable", label: "Favorable" },
  { value: "fair", label: "Fair" },
  { value: "guarded", label: "Guarded, poor, or grave" },
];

export const LATEST_START = [
  { value: "24h", label: "Within 24 hours" },
  { value: "2_7d", label: "Within 2 to 7 days" },
  { value: "7d_plus", label: "More than 7 days or routine" },
];

export const LIKELY_RESULT = [
  { value: "no_harm", label: "No material near-term harm" },
  { value: "worsening", label: "Worsening condition or pain, or more difficult treatment" },
  { value: "severe", label: "Permanent injury, organ impairment, life-threatening decline, or death" },
];

export const PREVENTABLE = [
  { value: "no", label: "No or not applicable" },
  { value: "yes_current", label: "Yes, and the measure was current or medically contraindicated" },
  { value: "yes_overdue", label: "Yes, and the measure was overdue or omitted" },
];

export const COSMETIC = [
  { value: "no", label: "No" },
  { value: "yes_medical", label: "Yes, but medically necessary for a documented condition" },
  { value: "yes_cosmetic", label: "Yes, cosmetic or nontherapeutic. Those charges are separately identified for exclusion" },
];

export const PUBLIC_NOTICE =
  "PUBLIC COMMUNITY VERIFICATION NOTICE. As part of ticket processing, Help a Pet creates redacted, view-only copies of the itemized invoice and/or estimate and this attestation. The member shares the system-created ticket post containing the public verification link; the member does not redact the documents. The public copies may show only the clinic name, city, state, ZIP, service descriptions, dates, charges, and non-identifying attestation answers. Help a Pet redacts the clinic street address and contact information; owner/member and pet identifiers appearing on the documents; veterinarian and staff information; signatures; license information; MID, processor, payment/account identifiers; and all other nonpublic fields. The copies are displayed for community review and are not offered for download.";

export const CERTIFICATION =
  "I CERTIFY: I certify, based on my knowledge and the clinic record, that the answers and attachments are true, correct, and complete in all material respects. I separately identified routine, preventive, planned, spay/neuter, end-of-life, postmortem, cosmetic, convenience-only, and nontherapeutic lines. Any appearance- or function-altering service claimed as medically necessary has a documented diagnosis and clinical indication. I authorize verification and understand that a knowingly material false or misleading submission may result in denial or recovery of funds, platform suspension, and referral as permitted by law to licensing, payment, financial, or law-enforcement authorities.";

export function validateAttestation(v: AttestationValues): string | null {
  if (!v.pet_name.trim()) return "Pet name is required.";
  if (!v.pet_type) return "Select the type of pet.";
  if (!v.clinic_name.trim()) return "Clinic name is required.";
  if (!v.clinic_city.trim() || !v.clinic_state.trim() || !v.clinic_zip.trim())
    return "Clinic city, state and ZIP are required.";
  if (!v.vet_legal_name.trim()) return "Veterinarian legal name is required.";
  if (!v.license_state.trim() || !v.license_number.trim())
    return "License state and number are required.";
  if (!v.no_traditional_mid && !v.merchant_id.trim())
    return "Enter the Merchant ID, or tick “No traditional MID issued”.";
  if (!(v.answers.records_attached ?? []).length) return "Indicate which records are attached.";
  if (!(v.answers.service_types ?? []).length) return "Select the types of services.";
  if (!v.answers.service_status) return "Select the service status.";
  if (!v.answers.necropsy) return "Answer the necropsy question.";
  if (!v.answers.necropsy_only) {
    if (!v.answers.diagnosis) return "Select the diagnosis status.";
    if (!v.answers.prognosis) return "Select the prognosis.";
    if (!v.answers.latest_start) return "Select the latest medically reasonable time to begin care.";
    if (!v.answers.likely_result) return "Select the most likely result if care is delayed.";
  }
  if (!v.answers.preventable) return "Answer eligibility question A.";
  if (!v.answers.cosmetic) return "Answer eligibility question B.";
  if (!v.certified) return "The certification must be accepted.";
  if (v.signature_typed_name.trim().length < 3) return "Type the veterinarian's full legal name to sign.";
  if (!v.signed_date) return "Enter the date signed.";
  return null;
}
