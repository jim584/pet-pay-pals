import { makeGenericAdapter } from "./_generic.ts";
// Texas Board of Veterinary Medical Examiners public search.
export const lookup = makeGenericAdapter("TX", [
  { url: "https://vetlicensesearch.tbvme.texas.gov/api/licensees?licenseNumber=%LIC%", method: "GET" },
  { url: "https://vetlicensesearch.tbvme.texas.gov/?licenseNumber=%LIC%", method: "GET" },
]);
