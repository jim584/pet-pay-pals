import { makeGenericAdapter } from "./_generic.ts";
// Georgia Secretary of State verification portal.
export const lookup = makeGenericAdapter("GA", [
  { url: "https://verify.sos.ga.gov/verification/Search.aspx?facility=Y&licnum=%LIC%&Board=045", method: "GET" }, // 045 = Vet Med
]);
