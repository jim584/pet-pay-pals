// Board metadata for all 50 US states + DC. Used to (a) deep-link admins to the
// correct public license lookup and (b) drive the AdminVerificationCoveragePage.
export interface BoardInfo {
  code: string;
  name: string;
  board: string;
  lookup_url: string;
  // How verification currently works for this state:
  //   "adapter"       – automated lookup implemented (see per-state file)
  //   "manual"        – no automated adapter; always returns pending_review
  technique: "adapter" | "manual";
}

export const BOARDS: Record<string, BoardInfo> = {
  AL: { code: "AL", name: "Alabama", board: "Alabama State Board of Veterinary Medical Examiners", lookup_url: "https://vetbd.alabama.gov/rosters.aspx", technique: "manual" },
  AK: { code: "AK", name: "Alaska", board: "Alaska Board of Veterinary Examiners", lookup_url: "https://www.commerce.alaska.gov/cbp/main/search/professional", technique: "manual" },
  AZ: { code: "AZ", name: "Arizona", board: "Arizona State Veterinary Medical Examining Board", lookup_url: "https://azvetlicense.az.gov/apex/f?p=verify", technique: "manual" },
  AR: { code: "AR", name: "Arkansas", board: "Arkansas Veterinary Medical Examining Board", lookup_url: "https://www.arkansas.gov/avmeb/verification.php", technique: "manual" },
  CA: { code: "CA", name: "California", board: "California Veterinary Medical Board", lookup_url: "https://search.dca.ca.gov/", technique: "adapter" },
  CO: { code: "CO", name: "Colorado", board: "Colorado State Board of Veterinary Medicine (DORA)", lookup_url: "https://apps.colorado.gov/dre/licensing/Lookup/LicenseLookup.aspx", technique: "manual" },
  CT: { code: "CT", name: "Connecticut", board: "Connecticut Department of Public Health", lookup_url: "https://www.elicense.ct.gov/Lookup/LicenseLookup.aspx", technique: "manual" },
  DE: { code: "DE", name: "Delaware", board: "Delaware Board of Veterinary Medicine", lookup_url: "https://delpros.delaware.gov/OH_VerifyLicense", technique: "manual" },
  DC: { code: "DC", name: "District of Columbia", board: "DC Board of Veterinary Medicine", lookup_url: "https://dchealth.dc.gov/service/verify-license", technique: "manual" },
  FL: { code: "FL", name: "Florida", board: "Florida Board of Veterinary Medicine", lookup_url: "https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders", technique: "adapter" },
  GA: { code: "GA", name: "Georgia", board: "Georgia State Board of Veterinary Medicine", lookup_url: "https://verify.sos.ga.gov/verification/", technique: "adapter" },
  HI: { code: "HI", name: "Hawaii", board: "Hawaii Board of Veterinary Medicine", lookup_url: "https://mypvl.dcca.hawaii.gov/public-license-search/", technique: "manual" },
  ID: { code: "ID", name: "Idaho", board: "Idaho Board of Veterinary Medicine", lookup_url: "https://ibol.idaho.gov/eIBOL/Public/LicenseSearch.aspx", technique: "manual" },
  IL: { code: "IL", name: "Illinois", board: "Illinois Department of Financial and Professional Regulation", lookup_url: "https://ilesonline.idfpr.illinois.gov/DPR/Lookup/LicenseLookup.aspx", technique: "adapter" },
  IN: { code: "IN", name: "Indiana", board: "Indiana Board of Veterinary Medical Examiners", lookup_url: "https://mylicense.in.gov/everification/", technique: "manual" },
  IA: { code: "IA", name: "Iowa", board: "Iowa Board of Veterinary Medicine", lookup_url: "https://iowaagriculture.gov/veterinary-license-lookup", technique: "manual" },
  KS: { code: "KS", name: "Kansas", board: "Kansas Board of Veterinary Examiners", lookup_url: "https://ksbve.us.thentiacloud.net/webs/ksbve/register/", technique: "manual" },
  KY: { code: "KY", name: "Kentucky", board: "Kentucky Board of Veterinary Examiners", lookup_url: "https://kybve.ky.gov/Pages/Public-License-Search.aspx", technique: "manual" },
  LA: { code: "LA", name: "Louisiana", board: "Louisiana Board of Veterinary Medicine", lookup_url: "https://www.lsbvm.org/license-verification/", technique: "manual" },
  ME: { code: "ME", name: "Maine", board: "Maine Board of Veterinary Medicine", lookup_url: "https://www.pfr.maine.gov/almsonline/almsquery/", technique: "manual" },
  MD: { code: "MD", name: "Maryland", board: "Maryland State Board of Veterinary Medical Examiners", lookup_url: "https://mda.maryland.gov/vetboard/Pages/Search-License-Information.aspx", technique: "manual" },
  MA: { code: "MA", name: "Massachusetts", board: "Massachusetts Board of Registration in Veterinary Medicine", lookup_url: "https://checkalicense.hhs.state.ma.us/", technique: "manual" },
  MI: { code: "MI", name: "Michigan", board: "Michigan Board of Veterinary Medicine", lookup_url: "https://aca-prod.accela.com/MILARA/GeneralProperty/LicenseeSearch.aspx", technique: "adapter" },
  MN: { code: "MN", name: "Minnesota", board: "Minnesota Board of Veterinary Medicine", lookup_url: "https://mn.gov/boards/veterinary-medicine/public/licensee-lookup/", technique: "manual" },
  MS: { code: "MS", name: "Mississippi", board: "Mississippi Board of Veterinary Medicine", lookup_url: "https://www.mbvm.ms.gov/verify-license", technique: "manual" },
  MO: { code: "MO", name: "Missouri", board: "Missouri Veterinary Medical Board", lookup_url: "https://pr.mo.gov/licensee-search.asp", technique: "manual" },
  MT: { code: "MT", name: "Montana", board: "Montana Board of Veterinary Medicine", lookup_url: "https://ebiz.mt.gov/pol/", technique: "manual" },
  NE: { code: "NE", name: "Nebraska", board: "Nebraska Board of Veterinary Medicine and Surgery", lookup_url: "https://www.nebraska.gov/LISSearch/search.cgi", technique: "manual" },
  NV: { code: "NV", name: "Nevada", board: "Nevada State Board of Veterinary Medical Examiners", lookup_url: "https://nvvetboard.us/public-search/", technique: "manual" },
  NH: { code: "NH", name: "New Hampshire", board: "New Hampshire Board of Veterinary Medicine", lookup_url: "https://forms.nh.gov/license/", technique: "manual" },
  NJ: { code: "NJ", name: "New Jersey", board: "New Jersey State Board of Veterinary Medical Examiners", lookup_url: "https://newjersey.mylicense.com/verification/", technique: "manual" },
  NM: { code: "NM", name: "New Mexico", board: "New Mexico Board of Veterinary Medicine", lookup_url: "https://nmvetboard.us/verify-license/", technique: "manual" },
  NY: { code: "NY", name: "New York", board: "New York State Education Department – Office of the Professions", lookup_url: "https://www.op.nysed.gov/verification-search", technique: "adapter" },
  NC: { code: "NC", name: "North Carolina", board: "North Carolina Veterinary Medical Board", lookup_url: "https://portal.ncvmb.org/#/verifylicense", technique: "adapter" },
  ND: { code: "ND", name: "North Dakota", board: "North Dakota Board of Veterinary Medical Examiners", lookup_url: "https://www.nd.gov/ndvetboard/verify", technique: "manual" },
  OH: { code: "OH", name: "Ohio", board: "Ohio Veterinary Medical Licensing Board", lookup_url: "https://elicense.ohio.gov/oh_verifylicense", technique: "adapter" },
  OK: { code: "OK", name: "Oklahoma", board: "Oklahoma Board of Veterinary Medical Examiners", lookup_url: "https://okvetboard.us.thentiacloud.net/webs/portal/register/#/", technique: "manual" },
  OR: { code: "OR", name: "Oregon", board: "Oregon Veterinary Medical Examining Board", lookup_url: "https://obvm.oregon.gov/OnlineVerification", technique: "manual" },
  PA: { code: "PA", name: "Pennsylvania", board: "Pennsylvania State Board of Veterinary Medicine", lookup_url: "https://www.pals.pa.gov/#/page/search", technique: "adapter" },
  RI: { code: "RI", name: "Rhode Island", board: "Rhode Island Board of Veterinary Medicine", lookup_url: "https://healthri.mylicense.com/verification/", technique: "manual" },
  SC: { code: "SC", name: "South Carolina", board: "South Carolina State Board of Veterinary Medical Examiners", lookup_url: "https://verify.llronline.com/LicLookup/", technique: "manual" },
  SD: { code: "SD", name: "South Dakota", board: "South Dakota Board of Veterinary Medical Examiners", lookup_url: "https://sdlicensing.custhelp.com/", technique: "manual" },
  TN: { code: "TN", name: "Tennessee", board: "Tennessee Board of Veterinary Medical Examiners", lookup_url: "https://apps.health.tn.gov/Licensure/", technique: "manual" },
  TX: { code: "TX", name: "Texas", board: "Texas Board of Veterinary Medical Examiners", lookup_url: "https://vetlicensesearch.tbvme.texas.gov/", technique: "adapter" },
  UT: { code: "UT", name: "Utah", board: "Utah Division of Occupational and Professional Licensing", lookup_url: "https://secure.utah.gov/llv/search/index.html", technique: "manual" },
  VT: { code: "VT", name: "Vermont", board: "Vermont Board of Veterinary Medicine", lookup_url: "https://sos.vermont.gov/opr/find-a-professional/", technique: "manual" },
  VA: { code: "VA", name: "Virginia", board: "Virginia Board of Veterinary Medicine", lookup_url: "https://dhp.virginiainteractive.org/lookup/index", technique: "manual" },
  WA: { code: "WA", name: "Washington", board: "Washington State Veterinary Board of Governors", lookup_url: "https://fortress.wa.gov/doh/providercredentialsearch/", technique: "manual" },
  WV: { code: "WV", name: "West Virginia", board: "West Virginia Board of Veterinary Medicine", lookup_url: "https://wvbvm.org/verify-a-license/", technique: "manual" },
  WI: { code: "WI", name: "Wisconsin", board: "Wisconsin Veterinary Examining Board", lookup_url: "https://licensesearch.wi.gov/", technique: "manual" },
  WY: { code: "WY", name: "Wyoming", board: "Wyoming Board of Veterinary Medicine", lookup_url: "https://wyomingvetboard.wyo.gov/verify-a-license", technique: "manual" },
};

export const STATE_CODES = Object.keys(BOARDS).sort();
