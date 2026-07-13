// Generic heuristic adapter: best-effort attempt to hit a board's public lookup
// page and detect the license number + a status keyword in the response text.
// Each state can override URL/method/params via `attempts`. If nothing parses
// cleanly, we return `source_unavailable` (→ pending_review), never a false
// `no_match`, so admins retain the last word.
import type { LookupInput, LookupResult } from "./index.ts";
import { classifyStatus, fetchWithTimeout, namesMatch, normalize, stripTags, unavailable } from "./common.ts";
import { BOARDS } from "./boards.ts";

export interface Attempt {
  url: string;                          // fully-formed URL (may include %LIC% placeholder)
  method?: "GET" | "POST";
  body?: (lic: string) => string;       // form-encoded body builder for POST
  contentType?: string;
}

export function makeGenericAdapter(stateCode: string, attempts: Attempt[]) {
  const info = BOARDS[stateCode];
  const source = `state:${stateCode}`;
  const source_url = info?.lookup_url ?? null;

  return async (input: LookupInput): Promise<LookupResult> => {
    const lic = input.licenseNumber.trim();
    if (!lic) return unavailable(source, source_url, "Missing license number");

    let lastStatus: number | null = null;
    let lastError: string = "No adapter attempt produced a parseable response";

    for (const a of attempts) {
      try {
        const url = a.url.replace(/%LIC%/g, encodeURIComponent(lic));
        const res = await fetchWithTimeout(url, {
          method: a.method ?? "GET",
          body: a.method === "POST" ? a.body?.(lic) : undefined,
          headers: a.method === "POST"
            ? { "Content-Type": a.contentType ?? "application/x-www-form-urlencoded" }
            : undefined,
        });
        lastStatus = res.status;
        if (!res.ok) { lastError = `HTTP ${res.status}`; continue; }

        const raw = await res.text();
        const text = stripTags(raw);
        const textLc = text.toLowerCase();
        const licLc = lic.toLowerCase();

        // License number MUST appear on the page for any classification.
        if (!textLc.includes(licLc) && !textLc.includes(licLc.replace(/^0+/, ""))) {
          lastError = "License number not found in response";
          continue;
        }

        // Try to find a status keyword within ~120 chars of the license number.
        const idx = textLc.indexOf(licLc);
        const window = text.slice(Math.max(0, idx - 200), idx + 400);
        const status = classifyStatus(window);

        // Best-effort name extraction: capture a "Last, First" or "First Last"
        // pattern near the license number to feed namesMatch.
        const nameMatchWindow = window.match(/([A-Z][a-z]+(?:,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?|\s+[A-Z]\.?\s*[A-Z][a-z]+))/);
        const onRecord = nameMatchWindow?.[1] ?? "";

        if (status === "match") {
          if (!onRecord || namesMatch(input.fullLegalName, onRecord)) {
            return {
              status: "match",
              source, source_url,
              licensee_name: onRecord || null,
              license_status_text: window.slice(0, 240),
              http_status: res.status,
              raw: { snippet: window.slice(0, 800) },
            };
          }
          return {
            status: "no_match",
            source, source_url,
            reason: `License found but name on record (“${onRecord}”) does not match “${input.fullLegalName}”.`,
            licensee_name: onRecord,
            http_status: res.status,
            raw: { snippet: window.slice(0, 800) },
          };
        }
        if (status === "expired" || status === "inactive") {
          return {
            status,
            source, source_url,
            reason: `Board reports license as ${status}.`,
            licensee_name: onRecord || null,
            license_status_text: window.slice(0, 240),
            http_status: res.status,
            raw: { snippet: window.slice(0, 800) },
          };
        }
        // License present but no status keyword we recognize — punt to admin.
        lastError = "Could not classify license status from response";
      } catch (e) {
        lastError = `Fetch error: ${String((e as Error).message ?? e).slice(0, 200)}`;
      }
    }

    return unavailable(source, source_url, lastError, lastStatus);
  };
}

/** Convenience: an adapter that just makes a plain GET to `${lookup_url}?query=<lic>`
 *  variants. Useful for boards where we don't know the exact query parameter. */
export function makeUrlProbeAdapter(stateCode: string, params: string[]) {
  const url = BOARDS[stateCode]?.lookup_url ?? "";
  const attempts: Attempt[] = params.map(p => ({
    url: `${url}${url.includes("?") ? "&" : "?"}${p}=%LIC%`,
    method: "GET" as const,
  }));
  return makeGenericAdapter(stateCode, attempts);
}
