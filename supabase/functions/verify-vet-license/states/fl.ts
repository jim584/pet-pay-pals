import { makeGenericAdapter } from "./_generic.ts";
// Florida Department of Health MQA HealthCareProviders search — POST form.
export const lookup = makeGenericAdapter("FL", [
  {
    url: "https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders/Search",
    method: "POST",
    body: (lic) => new URLSearchParams({ SearchType: "LicenseNumber", LicenseNumber: lic, Profession: "Veterinarian" }).toString(),
  },
]);
