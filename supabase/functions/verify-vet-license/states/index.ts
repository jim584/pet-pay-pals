// State-lookup registry. Each module implements `lookup({licenseNumber, fullLegalName})`
// and returns a normalized LookupResult. Add a new state by creating a module
// and registering it here — no schema or UI changes required.

export type LookupStatus =
  | "match"
  | "no_match"
  | "expired"
  | "inactive"
  | "source_unavailable"
  | "ambiguous"
  | "not_supported";

export interface LookupInput {
  licenseNumber: string;
  fullLegalName: string;
}

export interface LookupResult {
  status: LookupStatus;
  source: string;             // e.g. "CA-BVM"
  source_url: string | null;  // human-visitable URL
  reason?: string;
  http_status?: number | null;
  licensee_name?: string | null;
  license_status_text?: string | null;
  expiration?: string | null;
  raw?: unknown;
}

// Registered state modules. Empty for now — no state offers a stable public API,
// so every state falls back to `not_supported` → `pending_review` and admins
// verify manually with an override. Plug new modules in here as they are built.
const REGISTRY: Record<string, (input: LookupInput) => Promise<LookupResult>> = {};

export const SUPPORTED_STATES = Object.keys(REGISTRY);

export async function lookupByState(state: string, input: LookupInput): Promise<LookupResult> {
  const key = state.toUpperCase();
  const fn = REGISTRY[key];
  if (!fn) {
    return {
      status: "not_supported",
      source: `state:${key}`,
      source_url: aavsbBoardUrl(key),
      reason: "Automated verification for this state is not yet available — an admin will review manually.",
      http_status: null,
      raw: null,
    };
  }
  return await fn(input);
}

// AAVSB maintains a directory of state veterinary boards; link admins to it
// so they can jump straight to the correct board lookup for manual review.
function aavsbBoardUrl(_state: string) {
  return "https://www.aavsb.org/public-resources/look-up-a-license/";
}

// Utility available to future state modules.
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z\s-]/g, "").replace(/\s+/g, " ").trim();
}

// Fuzzy last-name-exact + first-name-close matcher for future scrapers.
export function namesMatch(a: string, b: string): boolean {
  const an = normalizeName(a).split(" ");
  const bn = normalizeName(b).split(" ");
  if (an.length === 0 || bn.length === 0) return false;
  const lastA = an[an.length - 1];
  const lastB = bn[bn.length - 1];
  if (lastA !== lastB) return false;
  const firstA = an[0];
  const firstB = bn[0];
  return firstA === firstB || firstA.startsWith(firstB) || firstB.startsWith(firstA);
}
