// Fixture-driven tests for state adapters. Run with:
//   deno test --allow-read supabase/functions/verify-vet-license/states/
//
// These tests never hit a live board — they stub fetch with a saved response.
// Add one test per (state, case) once real fixtures are captured.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { withFixture } from "./_fixtures.ts";
import { lookup as ca } from "./ca.ts";

Deno.test("example fixture harness — CA active license classifies as match", async () => {
  await withFixture("ca-active.example.html", async () => {
    const r = await ca({ licenseNumber: "99999", fullLegalName: "Testvet Lastname" });
    assertEquals(r.status, "match", `expected match, got ${r.status} (${r.reason ?? ""})`);
  });
});
