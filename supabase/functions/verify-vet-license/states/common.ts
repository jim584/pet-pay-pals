// Shared helpers for per-state license lookup adapters.
import type { LookupResult, LookupStatus } from "./index.ts";

const USER_AGENT = "HelpAPet-VerificationBot/1.0 (+https://prowebbuilders.com/contact)";

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15000,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}

export function normalize(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = a[i - 1] === b[j - 1]
        ? m[i - 1][j - 1]
        : 1 + Math.min(m[i - 1][j], m[i][j - 1], m[i - 1][j - 1]);
    }
  }
  return m[a.length][b.length];
}

const NICKNAMES: Record<string, string[]> = {
  bob: ["robert"], rob: ["robert"], bobby: ["robert"],
  bill: ["william"], will: ["william"], billy: ["william"],
  jim: ["james"], jimmy: ["james"],
  mike: ["michael"], mick: ["michael"],
  dave: ["david"],
  chris: ["christopher", "christine", "christina"],
  liz: ["elizabeth"], beth: ["elizabeth"], eliza: ["elizabeth"],
  kate: ["katherine", "kathleen"], kathy: ["katherine", "kathleen"],
  meg: ["margaret"], maggie: ["margaret"], peggy: ["margaret"],
  nick: ["nicholas"],
  tony: ["anthony"],
  ed: ["edward"], eddie: ["edward"],
  sam: ["samuel", "samantha"],
  tom: ["thomas"], tommy: ["thomas"],
  dan: ["daniel"], danny: ["daniel"],
  matt: ["matthew"],
  joe: ["joseph"], joey: ["joseph"],
  jen: ["jennifer"], jenny: ["jennifer"],
  alex: ["alexander", "alexandra", "alexis"],
};

function firstNamesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  if (levenshtein(a, b) <= 2) return true;
  if ((NICKNAMES[a] ?? []).includes(b)) return true;
  if ((NICKNAMES[b] ?? []).includes(a)) return true;
  return false;
}

/** Last-name exact + first-name fuzzy match. Accepts "Last, First" or "First ... Last". */
export function namesMatch(expected: string, onRecord: string): boolean {
  const en = normalize(expected).split(" ").filter(Boolean);
  let on = normalize(onRecord);
  // "Last, First Middle" → "First Middle Last"
  if (on.includes(",")) {
    const [last, rest] = on.split(",").map(s => s.trim());
    on = `${rest} ${last}`.trim();
  }
  const rn = on.split(" ").filter(Boolean);
  if (en.length === 0 || rn.length === 0) return false;
  if (en[en.length - 1] !== rn[rn.length - 1]) return false;
  return firstNamesMatch(en[0], rn[0]);
}

/** Classify license-status text found on a board page into our LookupStatus. */
export function classifyStatus(text: string | null | undefined): LookupStatus | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/(current|active|good\s*standing|valid|clear|licensed)/.test(t)) return "match";
  if (/(expired|lapsed)/.test(t)) return "expired";
  if (/(inactive|retired|voluntary\s*surrender|suspended|revoked|cancell?ed|probation)/.test(t)) return "inactive";
  return null;
}

export function unavailable(source: string, source_url: string | null, reason: string, http_status: number | null = null): LookupResult {
  return { status: "source_unavailable", source, source_url, reason, http_status, raw: null };
}

export function notSupported(source: string, source_url: string | null, reason: string): LookupResult {
  return { status: "not_supported", source, source_url, reason, http_status: null, raw: null };
}

/** Strip HTML tags for coarse text search fallback when a DOM parser isn't warranted. */
export function stripTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
