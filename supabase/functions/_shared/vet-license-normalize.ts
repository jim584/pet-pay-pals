// Shared normalization + filtering rules for the veterinarian license database.
// Every import path (API, bulk file, admin upload) runs through this module so
// data quality is identical regardless of how a state's data arrives.

export interface RawRow {
  [key: string]: string | number | null | undefined;
}

export interface FieldMapping {
  // Column names (case-insensitive) in the source file for each target field.
  full_name?: string | string[];
  first_name?: string | string[];
  middle_name?: string | string[];
  last_name?: string | string[];
  license_number?: string | string[];
  license_status?: string | string[];
  license_type?: string | string[];
  address_line1?: string | string[];
  address_line2?: string | string[];
  city?: string | string[];
  address_state?: string | string[];
  postal_code?: string | string[];
  county?: string | string[];
  phone?: string | string[];
  issue_date?: string | string[];
  expiration_date?: string | string[];
  /** Extra accepted license-type values for this state (case-insensitive). */
  license_type_allow?: string[];
  /** License-type values to always drop for this state. */
  license_type_deny?: string[];
  /** Extra accepted status values for this state. */
  status_active_allow?: string[];
  /** Fixed-width column spec: [field, start, length][] */
  fixed_width?: [string, number, number][];
  /** Delimiter override for delimited files. */
  delimiter?: string;
  /** For JSON APIs: dotted path to the array of records. */
  records_path?: string;
}

/** Status values that count as an active, current license. */
const ACTIVE_STATUS = new Set([
  "active",
  "active license",
  "current",
  "clear",
  "clear/active",
  "active - clear",
  "current active",
  "licensed",
  "active in good standing",
  "good standing",
  "valid",
  "registered",
  "active/clear",
]);

/** Status values that are definitively NOT active. */
const INACTIVE_HINTS = [
  "expired",
  "pending",
  "closed",
  "inactive",
  "null",
  "void",
  "revoked",
  "suspended",
  "surrendered",
  "cancel",
  "retired",
  "delinquent",
  "lapsed",
  "deceased",
  "probation",
  "denied",
  "withdrawn",
  "not renewed",
  "emeritus",
];

/**
 * Accepted "standard Veterinary License" type labels. Specialty, technician,
 * medication clerk, facility/premise, temporary/intern, and student categories
 * are explicitly excluded.
 */
const STANDARD_TYPE = new Set([
  "veterinary license",
  "veterinarian",
  "veterinary",
  "veterinarian license",
  "doctor of veterinary medicine",
  "dvm",
  "vmd",
  "licensed veterinarian",
  "veterinary medicine",
  "vet",
  "veterinary physician",
]);

const TYPE_DENY_HINTS = [
  "technician",
  "technologist",
  "tech ",
  "vet tech",
  "specialty",
  "specialist",
  "medication clerk",
  "medication aide",
  "clerk",
  "facility",
  "premise",
  "premises",
  "hospital",
  "clinic",
  "mobile unit",
  "student",
  "intern",
  "temporary",
  "temp ",
  "provisional",
  "faculty",
  "limited",
  "euthanasia",
  "embryo",
  "chiropract",
  "acupunct",
  "artificial insemination",
  "assistant",
  "board certified",
  "preceptor",
  "reciprocity applicant",
];

export function clean(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

export function normalizeName(s: string): string {
  return clean(s)
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type StatusVerdict = "active" | "inactive" | "unknown";

export function classifyStatus(raw: string, extraActive: string[] = []): StatusVerdict {
  const s = clean(raw).toLowerCase();
  if (!s) return "unknown";
  const allow = new Set([...ACTIVE_STATUS, ...extraActive.map((x) => x.toLowerCase())]);
  if (allow.has(s)) return "active";
  if (INACTIVE_HINTS.some((h) => s.includes(h))) return "inactive";
  // "active" appearing as a word inside a longer label, e.g. "ACTIVE-RENEWED"
  if (/\bactive\b/.test(s) || /\bcurrent\b/.test(s)) return "active";
  return "unknown";
}

export type TypeVerdict = "standard" | "excluded" | "unknown";

export function classifyLicenseType(
  raw: string,
  allow: string[] = [],
  deny: string[] = [],
): TypeVerdict {
  const t = clean(raw).toLowerCase();
  // A state file with a single license category may omit the column entirely;
  // in that case the state mapping must declare `license_type_allow`.
  if (!t) return allow.length > 0 ? "standard" : "unknown";
  if (deny.some((d) => t.includes(d.toLowerCase()))) return "excluded";
  if (allow.some((a) => t === a.toLowerCase() || t.includes(a.toLowerCase()))) return "standard";
  if (TYPE_DENY_HINTS.some((h) => t.includes(h))) return "excluded";
  if (STANDARD_TYPE.has(t)) return "standard";
  // e.g. "VETERINARIAN - ACTIVE"; safe because deny hints were checked first.
  if (/\bveterinar/.test(t) && !/tech|special|clerk|facility|premise/.test(t)) return "standard";
  return "unknown";
}

function pick(row: RawRow, keys?: string | string[]): string {
  if (!keys) return "";
  const list = Array.isArray(keys) ? keys : [keys];
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) lower[k.toLowerCase().trim()] = v;
  for (const k of list) {
    const v = lower[k.toLowerCase().trim()];
    if (v !== undefined && v !== null && clean(v) !== "") return clean(v);
  }
  return "";
}

export function parseDate(v: string): string | null {
  const s = clean(v);
  if (!s) return null;
  // MM/DD/YYYY, YYYY-MM-DD, YYYYMMDD
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

export interface NormalizedRecord {
  state: string;
  license_number: string;
  full_name: string;
  normalized_name: string;
  first_name: string | null;
  last_name: string | null;
  license_status: string;
  license_status_raw: string | null;
  license_type: string;
  license_type_raw: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  address_state: string | null;
  postal_code: string | null;
  county: string | null;
  phone: string | null;
  issue_date: string | null;
  expiration_date: string | null;
}

export type RowOutcome =
  | { kind: "kept"; record: NormalizedRecord }
  | { kind: "filtered_status"; reason: string }
  | { kind: "filtered_type"; reason: string }
  | { kind: "invalid"; reason: string };

/**
 * Applies the two hard ingestion rules:
 *   1. keep only Active licenses
 *   2. keep only the standard Veterinary License type
 * Anything ambiguous is dropped rather than stored, so the database never
 * asserts an active license it cannot substantiate.
 */
export function normalizeRow(state: string, row: RawRow, mapping: FieldMapping): RowOutcome {
  const licenseNumber = pick(row, mapping.license_number ?? [
    "license_number", "license number", "license #", "licensenumber", "lic_no", "license_no",
    "credential number", "credential #", "cred_no", "licnbr", "license",
  ]);
  if (!licenseNumber) return { kind: "invalid", reason: "missing license number" };

  let full = pick(row, mapping.full_name ?? ["full_name", "name", "licensee name", "licensee", "practitioner name", "provider name"]);
  const first = pick(row, mapping.first_name ?? ["first_name", "first name", "firstname", "given name"]);
  const middle = pick(row, mapping.middle_name ?? ["middle_name", "middle name", "mid_name"]);
  const last = pick(row, mapping.last_name ?? ["last_name", "last name", "lastname", "surname"]);
  if (!full && (first || last)) full = [first, middle, last].filter(Boolean).join(" ");
  if (!full) return { kind: "invalid", reason: "missing veterinarian name" };
  // "LAST, FIRST MIDDLE" → "FIRST MIDDLE LAST"
  if (/^[^,]+,\s*[^,]+$/.test(full) && !first && !last) {
    const [l, rest] = full.split(",");
    full = `${clean(rest)} ${clean(l)}`;
  }

  const statusRaw = pick(row, mapping.license_status ?? ["license_status", "status", "license status", "cred_status", "credential status"]);
  const statusVerdict = classifyStatus(statusRaw, mapping.status_active_allow ?? []);
  if (statusVerdict !== "active") {
    return { kind: "filtered_status", reason: statusRaw || "(blank status)" };
  }

  const typeRaw = pick(row, mapping.license_type ?? ["license_type", "type", "license type", "profession", "board", "cred_type", "credential type", "licensetype"]);
  const typeVerdict = classifyLicenseType(typeRaw, mapping.license_type_allow ?? [], mapping.license_type_deny ?? []);
  if (typeVerdict !== "standard") {
    return { kind: "filtered_type", reason: typeRaw || "(blank type)" };
  }

  return {
    kind: "kept",
    record: {
      state: state.toUpperCase(),
      license_number: licenseNumber.toUpperCase(),
      full_name: full,
      normalized_name: normalizeName(full),
      first_name: first || null,
      last_name: last || null,
      license_status: "active",
      license_status_raw: statusRaw || null,
      license_type: "veterinary_license",
      license_type_raw: typeRaw || null,
      address_line1: pick(row, mapping.address_line1 ?? ["address_line1", "address", "addr1", "address 1", "street", "mailing address", "addressline1"]) || null,
      address_line2: pick(row, mapping.address_line2 ?? ["address_line2", "addr2", "address 2", "addressline2"]) || null,
      city: pick(row, mapping.city ?? ["city", "addresscity", "mailing city"]) || null,
      address_state: (pick(row, mapping.address_state ?? ["address_state", "st", "state", "addressstate"]) || null)?.toUpperCase() || null,
      postal_code: pick(row, mapping.postal_code ?? ["postal_code", "zip", "zipcode", "zip code", "addresszip"]) || null,
      county: pick(row, mapping.county ?? ["county", "addresscounty"]) || null,
      phone: pick(row, mapping.phone ?? ["phone", "phone_number", "telephone", "phone number", "business phone"]) || null,
      issue_date: parseDate(pick(row, mapping.issue_date ?? ["issue_date", "original license date", "date issued", "orig_iss_date", "effective date"])),
      expiration_date: parseDate(pick(row, mapping.expiration_date ?? ["expiration_date", "expiration date", "exp_date", "expires", "expiry"])),
    },
  };
}
