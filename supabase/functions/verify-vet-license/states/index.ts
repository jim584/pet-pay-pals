// State-lookup registry. Each module implements `lookup({licenseNumber, fullLegalName})`
// and returns a normalized LookupResult. Add a new state by creating a module
// and registering it here — no schema or UI changes required.

import { BOARDS, STATE_CODES } from "./boards.ts";
// NOTE (2026-07-13): Per user directive, ALL state adapters are held out of the
// live REGISTRY until each state's source has been individually researched,
// approved, and validated against a sanitized fixture with a known public
// example. The adapter modules (tx.ts, fl.ts, ny.ts, pa.ts, il.ts, oh.ts,
// ga.ts, nc.ts, ca.ts) remain in the tree as scaffolding for future work but
// none is wired up here. Every state currently falls through to
// `not_supported` → `pending_review`, which is the correct behavior:
//   - CA: F5 WAF blocks server-side lookups
//   - MI: LARA Accela robots.txt disallows automated crawling
//   - OH, GA, NC, PA, IL, NY: probed and blocked/timed out/captcha (2026-07-13)
//   - TX: portal URL corrected in boards.ts; adapter not yet researched
//   - FL: bulk-file vs live-lookup decision pending user approval

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
  source: string;             // e.g. "state:CA"
  source_url: string | null;  // human-visitable URL
  reason?: string;
  http_status?: number | null;
  licensee_name?: string | null;
  license_status_text?: string | null;
  expiration?: string | null;
  raw?: unknown;
}

// Registered adapters. Currently EMPTY per user directive — every state
// resolves to `not_supported` → `pending_review` until its source is approved
// and its adapter individually validated. See the note at the top of this file.
const REGISTRY: Record<string, (input: LookupInput) => Promise<LookupResult>> = {
  // Intentionally empty. Add a state here only after its adapter is validated.
};

export const SUPPORTED_STATES = Object.keys(REGISTRY).sort();
export { BOARDS, STATE_CODES };

export async function lookupByState(state: string, input: LookupInput): Promise<LookupResult> {
  const key = (state ?? "").toUpperCase();
  const fn = REGISTRY[key];
  const board = BOARDS[key];
  if (!fn) {
    return {
      status: "not_supported",
      source: `state:${key}`,
      source_url: board?.lookup_url ?? "https://www.aavsb.org/public-resources/look-up-a-license/",
      reason: board
        ? `Automated verification for ${board.name} is not yet available — an admin will review manually via ${board.board}.`
        : "Automated verification for this state is not yet available — an admin will review manually.",
      http_status: null,
      raw: null,
    };
  }
  return await fn(input);
}

// Legacy exports (kept for callers importing from this module directly).
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z\s-]/g, "").replace(/\s+/g, " ").trim();
}
export function namesMatch(a: string, b: string): boolean {
  const an = normalizeName(a).split(" ");
  const bn = normalizeName(b).split(" ");
  if (an.length === 0 || bn.length === 0) return false;
  const lastA = an[an.length - 1], lastB = bn[bn.length - 1];
  if (lastA !== lastB) return false;
  const firstA = an[0], firstB = bn[0];
  return firstA === firstB || firstA.startsWith(firstB) || firstB.startsWith(firstA);
}
