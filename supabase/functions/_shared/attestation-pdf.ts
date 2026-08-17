import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const LABELS: Record<string, Record<string, string>> = {
  pet_type: { dog: "Dog", cat: "Cat", other: "Other" },
  pet_status: { alive: "Alive", deceased: "Deceased" },
  records_attached: {
    estimate_invoice: "Itemized estimate and/or invoice",
    chart_note: "Current chart note or discharge summary",
    other_records: "Relevant labs, imaging, specialist, preventive, behavior, or emotional-wellbeing records",
  },
  service_types: {
    illness: "Illness, injury, or related diagnostics/treatment",
    routine: "Routine, preventive, or planned care, including elective spay/neuter",
    end_of_life: "End-of-life or postmortem service, including hospice, euthanasia, or necropsy",
  },
  service_status: { proposed: "Proposed or estimated", completed: "Completed or invoiced", both: "Both" },
  necropsy: { not_included: "Not included", proposed: "Proposed or scheduled", completed: "Completed" },
  diagnosis: { confirmed: "Confirmed", suspected: "Suspected", undetermined: "Not yet determined" },
  prognosis: { favorable: "Favorable", fair: "Fair", guarded: "Guarded, poor, or grave" },
  latest_start: { "24h": "Within 24 hours", "2_7d": "Within 2 to 7 days", "7d_plus": "More than 7 days or routine" },
  likely_result: {
    no_harm: "No material near-term harm",
    worsening: "Worsening condition or pain, or more difficult treatment",
    severe: "Permanent injury, organ impairment, life-threatening decline, or death",
  },
  preventable: {
    no: "No or not applicable",
    yes_current: "Yes, and the measure was current or medically contraindicated",
    yes_overdue: "Yes, and the measure was overdue or omitted",
  },
  cosmetic: {
    no: "No",
    yes_medical: "Yes, but medically necessary for a documented condition",
    yes_cosmetic: "Yes, cosmetic or nontherapeutic. Those charges are separately identified for exclusion",
  },
};

const CERTIFICATION =
  "I CERTIFY: I certify, based on my knowledge and the clinic record, that the answers and attachments are true, correct, and complete in all material respects. I separately identified routine, preventive, planned, spay/neuter, end-of-life, postmortem, cosmetic, convenience-only, and nontherapeutic lines. Any appearance- or function-altering service claimed as medically necessary has a documented diagnosis and clinical indication. I authorize verification and understand that a knowingly material false or misleading submission may result in denial or recovery of funds, platform suspension, and referral as permitted by law to licensing, payment, financial, or law-enforcement authorities.";

function label(group: string, v?: string | null) {
  if (!v) return "—";
  return LABELS[group]?.[v] ?? v;
}

function labelList(group: string, arr?: string[] | null) {
  if (!arr?.length) return "—";
  return arr.map((v) => label(group, v)).join("; ");
}

export async function buildAttestationPdf(a: Record<string, any>, ticketId?: string | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const margin = 50;
  const width = 612;
  const height = 792;
  const maxWidth = width - margin * 2;
  let page = doc.addPage([width, height]);
  let y = height - margin;

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < margin) {
      page = doc.addPage([width, height]);
      y = height - margin;
    }
  };

  const wrap = (text: string, size: number, f = font) => {
    const words = String(text).split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > maxWidth) {
        if (line) lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };

  const draw = (text: string, opts: { size?: number; f?: any; gap?: number; color?: any } = {}) => {
    const size = opts.size ?? 10;
    const f = opts.f ?? font;
    for (const line of wrap(text, size, f)) {
      newPageIfNeeded(size + 4);
      y -= size + 2;
      page.drawText(line, { x: margin, y, size, font: f, color: opts.color ?? rgb(0.1, 0.12, 0.2) });
    }
    y -= opts.gap ?? 4;
  };

  const field = (name: string, value: string) => draw(`${name}: ${value || "—"}`, { size: 10 });
  const heading = (t: string) => { newPageIfNeeded(30); y -= 8; draw(t, { size: 11, f: bold, gap: 2 }); };

  draw("HELP A PET TOGETHER", { size: 16, f: bold, gap: 0 });
  draw("VETERINARIAN ATTESTATION", { size: 13, f: bold, gap: 8 });
  draw(
    "Attach the itemized estimate or invoice and the current clinical record. A technician may prepare this form. The licensed veterinarian must review and sign it.",
    { size: 8.5, gap: 6 }
  );

  const ans = (a.answers ?? {}) as Record<string, any>;

  heading("1. PET, CLINIC, AND SIGNER");
  field("Pet name", a.pet_name);
  field("Age or DOB", a.pet_age_or_dob);
  field("Type", a.pet_type === "other" ? `Other — ${a.pet_type_other ?? ""}` : label("pet_type", a.pet_type));
  field("Breed", a.breed);
  field("Primary breed (if mixed)", a.primary_breed);
  field("Pet status", a.pet_status === "deceased"
    ? `Deceased — date of death ${a.date_of_death ?? "—"}`
    : label("pet_status", a.pet_status));
  field("Clinic name", a.clinic_name);
  field("Street address", a.clinic_street);
  field("City / State / ZIP", [a.clinic_city, a.clinic_state, a.clinic_zip].filter(Boolean).join(", "));
  field("Veterinarian legal name", a.vet_legal_name);
  field("License state / number", `${a.license_state ?? "—"} / ${a.license_number ?? "—"}`);
  field("Merchant ID (MID)", a.no_traditional_mid ? "No traditional MID issued" : a.merchant_id);
  field("Processor", a.processor);

  heading("2. RECORDS ATTACHED");
  draw(labelList("records_attached", ans.records_attached));

  heading("3. SERVICES AND LINE ITEMS");
  field("Service types", labelList("service_types", ans.service_types));
  field("Service status", label("service_status", ans.service_status));
  field("Necropsy", label("necropsy", ans.necropsy));
  if (ans.mixed_visit_notes) field("Mixed visit notes", String(ans.mixed_visit_notes));

  heading("4. CLINICAL FACTS");
  if (ans.necropsy_only) {
    draw("Skipped — request is solely for a necropsy.");
  } else {
    field("Diagnosis", label("diagnosis", ans.diagnosis));
    field("Prognosis", label("prognosis", ans.prognosis));
    field("Latest medically reasonable time to begin care", label("latest_start", ans.latest_start));
    field("Most likely result if delayed", label("likely_result", ans.likely_result));
  }

  heading("5. ELIGIBILITY FACTS");
  draw("A. Reasonably preventable by an established vaccine or ordinary preventive measure?", { size: 9.5, gap: 0 });
  draw(label("preventable", ans.preventable), { size: 10 });
  draw("B. Appearance- or function-altering service included?", { size: 9.5, gap: 0 });
  draw(label("cosmetic", ans.cosmetic), { size: 10 });

  heading("6. CERTIFICATION AND SIGNATURE");
  draw(`[X] ${CERTIFICATION}`, { size: 8 });
  y -= 6;
  draw(`Veterinarian signature (typed): /${a.signature_typed_name ?? ""}/`, { size: 11, f: italic, gap: 2 });
  field("Date signed", a.signed_date ?? "");
  field("Ticket ID", ticketId ?? a.ticket_id ?? "—");
  field("Attestation ID", a.id ?? "—");
  field("Completed", new Date().toISOString());
  y -= 6;
  draw(
    "The veterinarian supplies facts. Help a Pet determines eligibility, funding lane, and clinical priority. This document was completed electronically and flattened by Help A Pet.",
    { size: 8 }
  );

  return await doc.save();
}
