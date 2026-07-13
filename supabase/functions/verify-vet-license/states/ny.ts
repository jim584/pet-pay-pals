import { makeGenericAdapter } from "./_generic.ts";
// NYSED Office of the Professions — publishes a public roster JSON per profession.
// Veterinary Medicine profession code is "63".
export const lookup = makeGenericAdapter("NY", [
  { url: "https://www.op.nysed.gov/verification-search?profession=63&license_number=%LIC%", method: "GET" },
  { url: "https://eservices.nysed.gov/professions/verification-search?profession=63&license_number=%LIC%", method: "GET" },
]);
