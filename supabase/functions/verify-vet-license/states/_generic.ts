// Generic heuristic adapter: best-effort attempt to hit a board's public lookup
// page and detect the license number + a status keyword in the response text.
// Each state can override URL/method/params via `attempts`. If nothing parses
// cleanly, we return `source_unavailable` (→ pending_review), never a false
// `no_match`, so admins retain the last word.
//
// Reliability layer:
//   • Per-state throttle (1 req/sec) so we're a polite neighbor.
//   • 15s timeout per request (see common.fetchWithTimeout).
//   • One retry on network error / 5xx with 2s backoff. No retry on 4xx.
//   • In-memory circuit breaker: 3 consecutive `source_unavailable` results
//     per state trip the breaker for 60s — during that window we short-circuit
//     to `source_unavailable` immediately (still `pending_review`, never
//     `unverified`), sparing the board and speeding up the caller.
//
// Storage layer: raw board HTML is intentionally NOT returned. `raw` contains
// only a structured `decision` + `evidence` object safe to keep in the DB.
import type { LookupInput, LookupResult } from "./index.ts";
import { classifyStatus, fetchWithTimeout, namesMatch, stripTags, unavailable } from "./common.ts";
import { BOARDS } from "./boards.ts";

export interface Attempt {
  url: string;                          // fully-formed URL (may include %LIC% placeholder)
  method?: "GET" | "POST";
  body?: (lic: string) => string;       // form-encoded body builder for POST
  contentType?: string;
}

const STATE_QUEUES: Record<string, Promise<void>> = {};
const MIN_INTERVAL_MS = 1000;
const RETRY_BACKOFF_MS = 2000;

// Circuit breaker: consecutive failures per state and the time until which the
// breaker stays tripped.
interface Breaker { fails: number; trippedUntil: number }
const BREAKERS: Record<string, Breaker> = {};
const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 60_000;

export function _resetBreakerForTests(stateCode?: string) {
  if (stateCode) delete BREAKERS[stateCode];
  else for (const k of Object.keys(BREAKERS)) delete BREAKERS[k];
}

function noteSuccess(stateCode: string) {
  const b = BREAKERS[stateCode];
  if (b) { b.fails = 0; b.trippedUntil = 0; }
}
function noteFailure(stateCode: string) {
  const b = (BREAKERS[stateCode] ??= { fails: 0, trippedUntil: 0 });
  b.fails += 1;
  if (b.fails >= BREAKER_THRESHOLD) b.trippedUntil = Date.now() + BREAKER_COOLDOWN_MS;
}
function isTripped(stateCode: string) {
  const b = BREAKERS[stateCode];
  return !!b && b.trippedUntil > Date.now();
}

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

// One retry on network error / 5xx. Never retry 4xx (client error is
// deterministic and not the board's fault).
async function fetchWithRetry(stateCode: string, url: string, init: RequestInit): Promise<Response> {
  try {
    const res = await throttled(stateCode, () => fetchWithTimeout(url, init));
    if (res.status >= 500 && res.status < 600) {
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
      return await throttled(stateCode, () => fetchWithTimeout(url, init));
    }
    return res;
  } catch (e) {
    await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
    return await throttled(stateCode, () => fetchWithTimeout(url, init));
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

    if (isTripped(stateCode)) {
      return {
        ...unavailable(source, source_url, `Circuit breaker open for ${stateCode} — recent consecutive failures.`),
        raw: { decision: { reason_code: "circuit_breaker_open", state: stateCode } },
      };
    }

    let lastStatus: number | null = null;
    let lastError = "No adapter attempt produced a parseable response";
    let lastAttemptedUrl: string | null = null;

    for (const a of attempts) {
      const url = a.url.replace(/%LIC%/g, encodeURIComponent(lic));
      lastAttemptedUrl = url;
      try {
        const res = await fetchWithRetry(stateCode, url, {
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

        if (!textLc.includes(licLc) && !textLc.includes(licLc.replace(/^0+/, ""))) {
          lastError = "License number not found in response";
          continue;
        }

        const idx = textLc.indexOf(licLc);
        const window = text.slice(Math.max(0, idx - 200), idx + 400);
        const status = classifyStatus(window);
        const nameMatchWindow = window.match(/([A-Z][a-z]+(?:,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?|\s+[A-Z]\.?\s*[A-Z][a-z]+))/);
        const onRecord = nameMatchWindow?.[1] ?? "";
        // Short evidence string — status keywords + expiration hints only, no
        // free-form page text. Safe to persist.
        const evidence = (window.match(/(active|inactive|expired|lapsed|revoked|suspended|current|clear|delinquent|good\s*standing)[^.]{0,80}/i)?.[0] ?? "").slice(0, 200);

        if (status === "match") {
          const nameOk = !onRecord || namesMatch(input.fullLegalName, onRecord);
          noteSuccess(stateCode);
          if (nameOk) {
            return {
              status: "match",
              source, source_url,
              licensee_name: onRecord || null,
              license_status_text: evidence || null,
              http_status: res.status,
              raw: {
                decision: {
                  reason_code: "license_found_status_active",
                  matched_by: onRecord ? "license_and_name" : "license_only",
                  name_on_record: onRecord || null,
                  attempted_url: url,
                  evidence,
                },
              },
            };
          }
          return {
            status: "ambiguous",
            source, source_url,
            reason: `License is active for “${onRecord}” but applicant entered “${input.fullLegalName}” — needs admin review.`,
            licensee_name: onRecord,
            http_status: res.status,
            raw: {
              decision: {
                reason_code: "name_mismatch_pending_review",
                matched_by: "license_only",
                name_on_record: onRecord,
                expected_name: input.fullLegalName,
                attempted_url: url,
                evidence,
              },
            },
          };
        }
        if (status === "expired" || status === "inactive") {
          noteSuccess(stateCode);
          return {
            status,
            source, source_url,
            reason: `Board reports license as ${status}.`,
            licensee_name: onRecord || null,
            license_status_text: evidence || null,
            http_status: res.status,
            raw: {
              decision: {
                reason_code: `license_${status}`,
                matched_by: "license_only",
                name_on_record: onRecord || null,
                attempted_url: url,
                evidence,
              },
            },
          };
        }
        lastError = "Could not classify license status from response";
      } catch (e) {
        lastError = `Fetch error: ${String((e as Error).message ?? e).slice(0, 200)}`;
      }
    }

    noteFailure(stateCode);
    return {
      ...unavailable(source, source_url, lastError, lastStatus),
      raw: {
        decision: {
          reason_code: "source_unavailable",
          last_error: lastError,
          last_http_status: lastStatus,
          attempted_url: lastAttemptedUrl,
          consecutive_failures: BREAKERS[stateCode]?.fails ?? 1,
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
