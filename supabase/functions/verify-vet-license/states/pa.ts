import { makeGenericAdapter } from "./_generic.ts";
// Pennsylvania PALS public search.
export const lookup = makeGenericAdapter("PA", [
  { url: "https://www.pals.pa.gov/api/Search/SearchForPerson?LicenseNumber=%LIC%&Board=VETERINARY%20MEDICINE", method: "GET" },
]);
