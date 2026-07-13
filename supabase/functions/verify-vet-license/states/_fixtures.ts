// Test harness: stubs global.fetch with a fixture file so state adapter tests
// never hit a live licensing board. Usage:
//
//   import { withFixture, assertNoLiveFetch } from "../_fixtures.ts";
//   Deno.test("CA active license", () =>
//     withFixture("ca-active.txt", async () => {
//       const result = await lookup({ licenseNumber: "12345", fullLegalName: "Jane Doe" });
//       assertEquals(result.status, "match");
//     }));
//
// `withFixture` also guards against live network access: any fetch attempt
// during the test that isn't served by the stub throws instead of hitting the
// real board. Call `assertNoLiveFetch()` at the top of a test file's module
// scope to install a default deny outside of `withFixture` blocks.

const FIXTURE_DIR = new URL("./__fixtures__/", import.meta.url);

export async function withFixture<T>(
  fixture: string,
  fn: () => Promise<T>,
  init: { status?: number; headers?: HeadersInit } = {},
): Promise<T> {
  const body = await Deno.readTextFile(new URL(fixture, FIXTURE_DIR));
  const originalFetch = globalThis.fetch;
  let served = false;
  globalThis.fetch = (() => {
    served = true;
    return Promise.resolve(new Response(body, {
      status: init.status ?? 200,
      headers: init.headers ?? { "Content-Type": "text/html" },
    }));
  }) as typeof fetch;
  try {
    const result = await fn();
    if (!served) {
      // Adapter never called fetch — the test isn't exercising the network
      // path we intended. Fail loudly so nobody assumes it was verified.
      throw new Error(`Fixture "${fixture}" was loaded but the adapter never called fetch`);
    }
    return result;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/**
 * Install a process-wide fetch guard so any live network request during tests
 * throws. Call once at module scope in a test file.
 */
export function assertNoLiveFetch() {
  const denied: typeof fetch = ((input: RequestInfo | URL) => {
    const u = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    throw new Error(`Live network access blocked in tests: ${u}`);
  }) as typeof fetch;
  globalThis.fetch = denied;
}
