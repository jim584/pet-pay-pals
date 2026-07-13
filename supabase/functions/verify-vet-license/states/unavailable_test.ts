// Adapter behavior tests: verifies that a 503 or timeout response from a board
// causes the adapter to return `source_unavailable` (→ pending_review), never
// `no_match`. This is requirement #6 and #9 from the Phase 1 checklist:
// no vet is rejected solely because a licensing website is unavailable.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { lookup as ca } from "./ca.ts";

async function withFetch<T>(handler: (url: string, init: RequestInit) => Promise<Response>, fn: () => Promise<T>): Promise<T> {
  const orig = globalThis.fetch;
  globalThis.fetch = ((url: string, init?: RequestInit) => handler(url, init ?? {})) as typeof fetch;
  try { return await fn(); } finally { globalThis.fetch = orig; }
}

Deno.test("board returns 503 → source_unavailable (not no_match)", async () => {
  await withFetch(
    () => Promise.resolve(new Response("upstream error", { status: 503 })),
    async () => {
      const r = await ca({ licenseNumber: "12345", fullLegalName: "Jane Doe" });
      assertEquals(r.status, "source_unavailable");
    },
  );
});

Deno.test("board returns HTML without license number → source_unavailable", async () => {
  await withFetch(
    () => Promise.resolve(new Response("<html><body>No results found.</body></html>", { status: 200 })),
    async () => {
      const r = await ca({ licenseNumber: "12345", fullLegalName: "Jane Doe" });
      assertEquals(r.status, "source_unavailable");
    },
  );
});

Deno.test("fetch throws (network error) → source_unavailable", async () => {
  await withFetch(
    () => Promise.reject(new Error("ECONNRESET")),
    async () => {
      const r = await ca({ licenseNumber: "12345", fullLegalName: "Jane Doe" });
      assertEquals(r.status, "source_unavailable");
    },
  );
});
