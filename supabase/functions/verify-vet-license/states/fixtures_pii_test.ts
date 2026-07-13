// Lint test: fixture files must not carry sensitive PII or secrets. Runs
// against every file in `__fixtures__/` and fails if it matches an SSN, DOB,
// email, phone, auth header, cookie, token, or API-key pattern.
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";

const FIXTURE_DIR = new URL("./__fixtures__/", import.meta.url);

const FORBIDDEN: Array<{ name: string; re: RegExp }> = [
  { name: "SSN", re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { name: "DOB (YYYY-MM-DD)", re: /\b(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/ },
  { name: "email", re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i },
  { name: "phone", re: /\b\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/ },
  { name: "Authorization header", re: /authorization\s*:\s*\S+/i },
  { name: "Cookie header", re: /\bset-cookie\b|\bcookie\s*:/i },
  { name: "Bearer token", re: /\bBearer\s+[A-Za-z0-9._-]{16,}\b/ },
  { name: "API key literal", re: /\b(api[_-]?key|apikey|access[_-]?token|secret[_-]?key)\b\s*[:=]\s*\S+/i },
  { name: "Browserless URL", re: /browserless\.io/i },
];

Deno.test("fixtures contain no PII, auth headers, or secrets", async () => {
  let scanned = 0;
  try {
    for await (const entry of walk(FIXTURE_DIR, { includeDirs: false })) {
      if (entry.name.startsWith(".")) continue;
      scanned++;
      const text = await Deno.readTextFile(entry.path);
      for (const { name, re } of FORBIDDEN) {
        const hit = text.match(re);
        assert(!hit, `${entry.name} contains forbidden pattern (${name}): ${hit?.[0]}`);
      }
    }
  } catch (e) {
    if ((e as Error).name === "NotFound") return; // empty dir is fine
    throw e;
  }
  console.log(`Scanned ${scanned} fixture file(s) for PII/secret patterns.`);
});
