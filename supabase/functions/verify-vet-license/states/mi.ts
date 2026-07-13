import { makeGenericAdapter } from "./_generic.ts";
// Michigan LARA Accela licensee search.
export const lookup = makeGenericAdapter("MI", [
  {
    url: "https://aca-prod.accela.com/MILARA/GeneralProperty/LicenseeSearch.aspx",
    method: "POST",
    body: (lic) => new URLSearchParams({ ctl00_PlaceHolderMain_refLicenseeSearchForm_txtLicenseNumber: lic }).toString(),
  },
]);
