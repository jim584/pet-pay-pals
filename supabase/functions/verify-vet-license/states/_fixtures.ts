// Test harness: stubs global.fetch with a fixture file so state adapter tests
// never hit a live licensing board. Usage:
//
//   import { withFixture } from "../_fixtures.ts";
//   Deno.test("CA active license", () =>
//     withFixture("ca-active.txt", async () => {
//       const result = await lookup({ licenseNumber: "12345", fullLegalName: "Jane Doe" });
//       assertEquals(result.status, "match");
//     }));

const FIXTURE_DIR = new URL("./__fixtures__/", import.meta.url);

export async function withFixture<T>(
  fixture: string,
  fn: () => Promise<T>,
  init: { status?: number; headers?: HeadersInit } = {},
): Promise<T> {
  const body = await Deno.readTextFile(new URL(fixture, FIXTURE_DIR));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(new Response(body, {
      status: init.status ?? 200,
      headers: init.headers ?? { "Content-Type": "text/html" },
    }));
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}
