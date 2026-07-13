import { makeGenericAdapter } from "./_generic.ts";
// NC Veterinary Medical Board portal (Thentia-hosted).
export const lookup = makeGenericAdapter("NC", [
  { url: "https://portal.ncvmb.org/api/directory/search?licenseNumber=%LIC%", method: "GET" },
  { url: "https://portal.ncvmb.org/#/verifylicense?license=%LIC%", method: "GET" },
]);
