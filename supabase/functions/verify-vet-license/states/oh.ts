import { makeGenericAdapter } from "./_generic.ts";
// Ohio eLicense public verification.
export const lookup = makeGenericAdapter("OH", [
  { url: "https://elicense.ohio.gov/oh_verifylicense?licnum=%LIC%", method: "GET" },
  { url: "https://elicense3.com.ohio.gov/api/lookup?licenseNumber=%LIC%", method: "GET" },
]);
