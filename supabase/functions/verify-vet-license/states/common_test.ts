// Unit tests for shared name-matching and status classification.
// Run with: deno test --allow-read supabase/functions/verify-vet-license/states/

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyStatus, namesMatch, normalize } from "./common.ts";

Deno.test("normalize strips diacritics + punctuation", () => {
  assertEquals(normalize("José M. O'Brien-Smith, DVM"), "jose m obrien-smith dvm");
});

Deno.test("namesMatch: exact first + last", () => {
  assertEquals(namesMatch("Jane Doe", "Jane Doe"), true);
});

Deno.test("namesMatch: 'Last, First' swap", () => {
  assertEquals(namesMatch("Jane Doe", "Doe, Jane M"), true);
});

Deno.test("namesMatch: diacritics ignored", () => {
  assertEquals(namesMatch("José García", "Jose Garcia"), true);
});

Deno.test("namesMatch: nickname (Bob ↔ Robert)", () => {
  assertEquals(namesMatch("Bob Smith", "Robert Smith"), true);
});

Deno.test("namesMatch: Levenshtein ≤ 2", () => {
  assertEquals(namesMatch("Katherine Miller", "Katharine Miller"), true);
});

Deno.test("namesMatch: last-name mismatch rejects", () => {
  assertEquals(namesMatch("Jane Doe", "Jane Roe"), false);
});

Deno.test("namesMatch: first-name unrelated rejects", () => {
  assertEquals(namesMatch("Jane Doe", "Charles Doe"), false);
});

Deno.test("classifyStatus recognizes active states", () => {
  assertEquals(classifyStatus("License Status: Active — Current"), "match");
  assertEquals(classifyStatus("Status: Good Standing"), "match");
});

Deno.test("classifyStatus recognizes expired/inactive", () => {
  assertEquals(classifyStatus("License Expired 2020-06-30"), "expired");
  assertEquals(classifyStatus("Status: Suspended"), "inactive");
  assertEquals(classifyStatus("Status: Revoked"), "inactive");
});

Deno.test("classifyStatus returns null for unrecognized text", () => {
  assertEquals(classifyStatus("pending renewal awaiting fees"), null);
});
