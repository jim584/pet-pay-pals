import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  AttestationValues, PET_TYPES, RECORDS_ATTACHED, SERVICE_TYPES, SERVICE_STATUS,
  NECROPSY, DIAGNOSIS, PROGNOSIS, LATEST_START, LIKELY_RESULT, PREVENTABLE, COSMETIC,
  PUBLIC_NOTICE, CERTIFICATION,
} from "@/lib/attestation-schema";

type Opt = { value: string; label: string };

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
        {n}
      </span>
      <h3 className="font-semibold text-sm uppercase tracking-wide">{children}</h3>
    </div>
  );
}

function RadioRow({ label, options, value, onChange }: {
  label: string; options: Opt[]; value?: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <RadioGroup value={value ?? ""} onValueChange={onChange} className="space-y-1.5">
        {options.map((o) => (
          <label key={o.value} className="flex items-start gap-2 rounded-md border border-border p-2.5 cursor-pointer">
            <RadioGroupItem value={o.value} className="mt-0.5" />
            <span className="text-sm leading-snug">{o.label}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

function CheckRow({ label, options, values, onChange }: {
  label: string; options: Opt[]; values: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (val: string, on: boolean) =>
    onChange(on ? [...values, val] : values.filter((v) => v !== val));
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="space-y-1.5">
        {options.map((o) => (
          <label key={o.value} className="flex items-start gap-2 rounded-md border border-border p-2.5 cursor-pointer">
            <Checkbox
              className="mt-0.5"
              checked={values.includes(o.value)}
              onCheckedChange={(c) => toggle(o.value, c === true)}
            />
            <span className="text-sm leading-snug">{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function AttestationForm({ value, onChange }: {
  value: AttestationValues;
  onChange: (v: AttestationValues) => void;
}) {
  const set = <K extends keyof AttestationValues>(k: K, v: AttestationValues[K]) =>
    onChange({ ...value, [k]: v });
  const setAnswer = (k: string, v: unknown) =>
    onChange({ ...value, answers: { ...value.answers, [k]: v } });

  const necropsyOnly = !!value.answers.necropsy_only;

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Attach the itemized estimate or invoice and the current clinical record. A technician may
        prepare this form. The licensed veterinarian must review and sign it. Please type the
        answers wherever possible.
      </p>

      <SectionTitle n={1}>Confirm the pet, clinic, and signer</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Pet name</Label><Input value={value.pet_name} onChange={(e) => set("pet_name", e.target.value)} /></div>
        <div><Label>Age or DOB</Label><Input value={value.pet_age_or_dob} onChange={(e) => set("pet_age_or_dob", e.target.value)} /></div>
      </div>
      <RadioRow label="Type" options={PET_TYPES} value={value.pet_type} onChange={(v) => set("pet_type", v)} />
      {value.pet_type === "other" && (
        <div><Label>Describe type</Label><Input value={value.pet_type_other} onChange={(e) => set("pet_type_other", e.target.value)} /></div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Breed</Label><Input value={value.breed} onChange={(e) => set("breed", e.target.value)} /></div>
        <div><Label>If mixed, primary breed</Label><Input value={value.primary_breed} onChange={(e) => set("primary_breed", e.target.value)} /></div>
      </div>
      <RadioRow
        label="Pet status at submission"
        options={[{ value: "alive", label: "Alive" }, { value: "deceased", label: "Deceased" }]}
        value={value.pet_status}
        onChange={(v) => set("pet_status", v)}
      />
      {value.pet_status === "deceased" && (
        <div><Label>Date of death</Label><Input type="date" value={value.date_of_death} onChange={(e) => set("date_of_death", e.target.value)} /></div>
      )}
      <div><Label>Clinic name</Label><Input value={value.clinic_name} onChange={(e) => set("clinic_name", e.target.value)} /></div>
      <div><Label>Street address</Label><Input value={value.clinic_street} onChange={(e) => set("clinic_street", e.target.value)} /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><Label>City</Label><Input value={value.clinic_city} onChange={(e) => set("clinic_city", e.target.value)} /></div>
        <div><Label>State</Label><Input maxLength={2} value={value.clinic_state} onChange={(e) => set("clinic_state", e.target.value.toUpperCase())} /></div>
        <div><Label>ZIP</Label><Input value={value.clinic_zip} onChange={(e) => set("clinic_zip", e.target.value)} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3"><Label>Veterinarian legal name</Label><Input value={value.vet_legal_name} onChange={(e) => set("vet_legal_name", e.target.value)} /></div>
        <div><Label>License state</Label><Input maxLength={2} value={value.license_state} onChange={(e) => set("license_state", e.target.value.toUpperCase())} /></div>
        <div className="sm:col-span-2"><Label>License no.</Label><Input value={value.license_number} onChange={(e) => set("license_number", e.target.value)} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Merchant ID (MID)</Label>
          <Input value={value.merchant_id} disabled={value.no_traditional_mid}
                 onChange={(e) => set("merchant_id", e.target.value)} />
        </div>
        <div><Label>Processor</Label><Input value={value.processor} onChange={(e) => set("processor", e.target.value)} /></div>
      </div>
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <Checkbox className="mt-0.5" checked={value.no_traditional_mid}
                  onCheckedChange={(c) => set("no_traditional_mid", c === true)} />
        No traditional MID issued
      </label>
      <p className="text-xs text-muted-foreground">
        Find the MID on the processor statement or portal, settlement/funding report, welcome letter,
        or terminal label. Do not enter a batch, transaction, terminal, gateway, or bank-account number.
      </p>

      <Separator />
      <SectionTitle n={2}>Attach the records</SectionTitle>
      <CheckRow
        label="Attach all available records relevant to this request"
        options={RECORDS_ATTACHED}
        values={value.answers.records_attached ?? []}
        onChange={(v) => setAnswer("records_attached", v)}
      />
      <p className="text-xs text-muted-foreground">
        Clinical records remain private and are not included in the public copy.
      </p>

      <Separator />
      <SectionTitle n={3}>Identify the services and line items</SectionTitle>
      <CheckRow
        label="Types of services on the attached estimate or invoice (check all that apply)"
        options={SERVICE_TYPES}
        values={value.answers.service_types ?? []}
        onChange={(v) => setAnswer("service_types", v)}
      />
      <RadioRow label="Service status" options={SERVICE_STATUS} value={value.answers.service_status} onChange={(v) => setAnswer("service_status", v)} />
      <RadioRow label="Necropsy" options={NECROPSY} value={value.answers.necropsy} onChange={(v) => setAnswer("necropsy", v)} />
      <div>
        <Label>For a mixed visit, identify which charges are routine, illness/injury, or end-of-life/postmortem</Label>
        <Textarea rows={3} value={value.answers.mixed_visit_notes ?? ""} onChange={(e) => setAnswer("mixed_visit_notes", e.target.value)} />
      </div>

      <Separator />
      <SectionTitle n={4}>Confirm the clinical facts</SectionTitle>
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <Checkbox className="mt-0.5" checked={necropsyOnly}
                  onCheckedChange={(c) => setAnswer("necropsy_only", c === true)} />
        This request is solely for a necropsy (skip this section)
      </label>
      {!necropsyOnly && (
        <div className="space-y-4">
          <RadioRow label="Diagnosis in the attached record" options={DIAGNOSIS} value={value.answers.diagnosis} onChange={(v) => setAnswer("diagnosis", v)} />
          <RadioRow label="Prognosis with recommended care" options={PROGNOSIS} value={value.answers.prognosis} onChange={(v) => setAnswer("prognosis", v)} />
          <RadioRow label="Latest medically reasonable time to begin care" options={LATEST_START} value={value.answers.latest_start} onChange={(v) => setAnswer("latest_start", v)} />
          <RadioRow label="Most likely result if care begins after that time" options={LIKELY_RESULT} value={value.answers.likely_result} onChange={(v) => setAnswer("likely_result", v)} />
          <p className="text-xs text-muted-foreground">
            Help a Pet determines priority from the records and its clinical rules, not from the
            selected timeframe alone.
          </p>
        </div>
      )}

      <Separator />
      <SectionTitle n={5}>Answer the eligibility facts</SectionTitle>
      <RadioRow
        label="A. Was the treated condition reasonably preventable by an established vaccine or ordinary preventive measure due before onset?"
        options={PREVENTABLE} value={value.answers.preventable} onChange={(v) => setAnswer("preventable", v)}
      />
      <RadioRow
        label="B. Does the request include an appearance- or function-altering service?"
        options={COSMETIC} value={value.answers.cosmetic} onChange={(v) => setAnswer("cosmetic", v)}
      />
      <p className="text-xs text-muted-foreground">
        Examples include nontherapeutic ear cropping, tail docking, declawing, and devocalization.
        Any medical exception must be documented in the record.
      </p>

      <Separator />
      <SectionTitle n={6}>Public copy, certification, and signature</SectionTitle>
      <p className="text-xs text-muted-foreground leading-relaxed">{PUBLIC_NOTICE}</p>
      <label className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 cursor-pointer">
        <Checkbox className="mt-0.5" checked={value.certified}
                  onCheckedChange={(c) => set("certified", c === true)} />
        <span className="text-xs leading-relaxed">{CERTIFICATION}</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Veterinarian signature — type full legal name</Label>
          <Input
            value={value.signature_typed_name}
            onChange={(e) => set("signature_typed_name", e.target.value)}
            placeholder="Jane A. Smith, DVM"
          />
          {value.signature_typed_name.trim() && (
            <p className="mt-1 text-sm font-medium italic">/{value.signature_typed_name.trim()}/</p>
          )}
        </div>
        <div>
          <Label>Date signed</Label>
          <Input type="date" value={value.signed_date} onChange={(e) => set("signed_date", e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        The veterinarian supplies facts. Help a Pet determines eligibility, funding lane, and clinical priority.
      </p>
    </div>
  );
}
