// Generic heuristic adapter: best-effort attempt to hit a board's public lookup
// page and detect the license number + a status keyword in the response text.
// Each state can override URL/method/params via `attempts`. If nothing parses
// cleanly, we return `source_unavailable` (→ pending_review), never a false
// `no_match`, so admins retain the last word.
import type { LookupInput, LookupResult } from "./index.ts";
import { classifyStatus, fetchWithTimeout, namesMatch, stripTags, unavailable } from "./common.ts";
import { BOARDS } from "./boards.ts";

export interface Attempt {
  url: string;                          // fully-formed URL (may include %LIC% placeholder)
  method?: "GET" | "POST";
  body?: (lic: string) => string;       // form-encoded body builder for POST
  contentType?: string;
}

// Per-state throttle: at most 1 outbound request/sec per board, so we're a
// polite neighbor and don't trigger board-side rate limiters. In-memory only;
// each edge-function invocation starts fresh, which is fine given our volume.
const STATE_QUEUES: Record<string, Promise<void>> = {};
const MIN_INTERVAL_MS = 1000;

async function throttled<T>(stateCode: string, fn: () => Promise<T>): Promise<T> {
  const prev = STATE_QUEUES[stateCode] ?? Promise.resolve();
  let release!: () => void;
  const nextGate = new Promise<void>((r) => { release = r; });
  STATE_QUEUES[stateCode] = prev.then(() => nextGate);
  await prev;
  try {
    return await fn();
  } finally {
    setTimeout(release, MIN_INTERVAL_MS);
  }
}

export function makeGenericAdapter(stateCode: string, attempts: Attempt[]) {
  const info = BOARDS[stateCode];
  const source = `state:${stateCode}`;
  const source_url = info?.lookup_url ?? null;

  return async (input: LookupInput): Promise<LookupResult> => {
    const lic = input.licenseNumber.trim();
    if (!lic) {
      return {
        ...unavailable(source, source_url, "Missing license number"),
        raw: { decision: { reason_code: "missing_license_number" } },
      };
    }

    let lastStatus: number | null = null;
    let lastError = "No adapter attempt produced a parseable response";
    let lastAttemptedUrl: string | null = null;

    for (const a of attempts) {
      const url = a.url.replace(/%LIC%/g, encodeURIComponent(lic));
      lastAttemptedUrl = url;
      try {
        const res = await throttled(stateCode, () => fetchWithTimeout(url, {
          method: a.method ?? "GET",
          body: a.method === "POST" ? a.body?.(lic) : undefined,
          headers: a.method === "POST"
            ? { "Content-Type": a.contentType ?? "application/x-www-form-urlencoded" }
            : undefined,
        }));
        lastStatus = res.status;
        if (!res.ok) { lastError = `HTTP ${res.status}`; continue; }

        const raw = await res.text();
        const text = stripTags(raw);
        const textLc = text.toLowerCase();
        const licLc = lic.toLowerCase();

        if (!textLc.includes(licLc) && !textLc.includes(licLc.replace(/^0+/, ""))) {
          lastError = "License number not found in response";
          continue;
        }

        const idx = textLc.indexOf(licLc);
        const window = text.slice(Math.max(0, idx - 200), idx + 400);
        const status = classifyStatus(window);
        const nameMatchWindow = window.match(/([A-Z][a-z]+(?:,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?|\s+[A-Z]\.?\s*[A-Z][a-z]+))/);
        const onRecord = nameMatchWindow?.[1] ?? "";

        if (status === "match") {
          const nameOk = !onRecord || namesMatch(input.fullLegalName, onRecord);
          if (nameOk) {
            return {
              status: "match",
              source, source_url,
              licensee_name: onRecord || null,
              license_status_text: window.slice(0, 240),
              http_status: res.status,
              raw: {
                snippet: window.slice(0, 800),
                decision: {
                  reason_code: "license_found_status_active",
                  matched_by: onRecord ? "license_and_name" : "license_only",
                  name_on_record: onRecord || null,
                  attempted_url: url,
                },
              },
            };
          }
          return {
            status: "no_match",
            source, source_url,
            reason: `License found but name on record (“${onRecord}”) does not match “${input.fullLegalName}”.`,
            licensee_name: onRecord,
            http_status: res.status,
            raw: {
              snippet: window.slice(0, 800),
              decision: {
                reason_code: "name_mismatch",
                matched_by: "license_only",
                name_on_record: onRecord,
                expected_name: input.fullLegalName,
                attempted_url: url,
              },
            },
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
            raw: {
              snippet: window.slice(0, 800),
              decision: {
                reason_code: `license_${status}`,
                matched_by: "license_only",
                name_on_record: onRecord || null,
                attempted_url: url,
              },
            },
          };
        }
        lastError = "Could not classify license status from response";
      } catch (e) {
        lastError = `Fetch error: ${String((e as Error).message ?? e).slice(0, 200)}`;
      }
    }

    return {
      ...unavailable(source, source_url, lastError, lastStatus),
      raw: {
        decision: {
          reason_code: "source_unavailable",
          last_error: lastError,
          last_http_status: lastStatus,
          attempted_url: lastAttemptedUrl,
        },
      },
    };
  };
}

/** Convenience for boards where we only know a couple of possible query params. */
export function makeUrlProbeAdapter(stateCode: string, params: string[]) {
  const url = BOARDS[stateCode]?.lookup_url ?? "";
  const attempts: Attempt[] = params.map((p) => ({
    url: `${url}${url.includes("?") ? "&" : "?"}${p}=%LIC%`,
    method: "GET" as const,
  }));
  return makeGenericAdapter(stateCode, attempts);
}
