import { makeGenericAdapter } from "./_generic.ts";
// California DCA License Search — the site uses a POST form to the ASP.NET
// backend. Best-effort GET probe first, then a couple of common param shapes.
export const lookup = makeGenericAdapter("CA", [
  { url: "https://search.dca.ca.gov/results?boardCode=39&licenseType=VET&licenseNumber=%LIC%", method: "GET" },
  { url: "https://search.dca.ca.gov/details/39/VET/%LIC%/", method: "GET" },
]);
