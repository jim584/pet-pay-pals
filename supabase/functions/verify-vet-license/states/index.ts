// State-lookup registry. Each module implements `lookup({licenseNumber, fullLegalName})`
// and returns a normalized LookupResult. Add a new state by creating a module
// and registering it here — no schema or UI changes required.

import { BOARDS, STATE_CODES } from "./boards.ts";
import { lookup as ca } from "./ca.ts";
import { lookup as tx } from "./tx.ts";
import { lookup as fl } from "./fl.ts";
import { lookup as ny } from "./ny.ts";
import { lookup as pa } from "./pa.ts";
import { lookup as il } from "./il.ts";
import { lookup as oh } from "./oh.ts";
import { lookup as ga } from "./ga.ts";
import { lookup as nc } from "./nc.ts";
// MI intentionally NOT registered: LARA Accela robots.txt disallows automated crawling.

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

// Registered adapters. Any state not present here falls back to
// `not_supported` → `pending_review` (admins verify manually).
const REGISTRY: Record<string, (input: LookupInput) => Promise<LookupResult>> = {
  CA: ca, TX: tx, FL: fl, NY: ny, PA: pa,
  IL: il, OH: oh, GA: ga, NC: nc,
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
