import { makeGenericAdapter } from "./_generic.ts";
// Illinois IDFPR license lookup.
export const lookup = makeGenericAdapter("IL", [
  {
    url: "https://ilesonline.idfpr.illinois.gov/DPR/Lookup/LicenseLookup.aspx",
    method: "POST",
    body: (lic) => new URLSearchParams({ LicenseNumber: lic, ProfessionCode: "090" }).toString(), // 090 = Veterinarian
  },
]);
