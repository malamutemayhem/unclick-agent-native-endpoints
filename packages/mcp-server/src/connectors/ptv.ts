import type { ConnectorConfig } from "./index.js";

export const ptvConnector: ConnectorConfig = {
  name:     "PTV",
  slug:     "ptv",
  authType: "api_key",
  description:
    "Public Transport Victoria Timetable API. Get live departures, disruptions, route stops, and scheduled runs for trains, trams, buses, and V/Line services across Victoria, Australia.",
  credentialFields: [
    {
      key:         "user_id",
      label:       "Developer ID",
      description: "PTV API developer ID (numeric). Obtained by registering for PTV API access.",
      secret:      false,
      placeholder: "3003726",
      findGuideUrl: "https://ptv.vic.gov.au/footer/data-and-reporting/datasets/ptv-timetable-api/",
    },
    {
      key:         "api_key",
      label:       "API Key",
      description: "PTV API key (UUID format). Used as the HMAC-SHA1 signing secret for all requests.",
      secret:      true,
      placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      findGuideUrl: "https://ptv.vic.gov.au/footer/data-and-reporting/datasets/ptv-timetable-api/",
    },
  ],
  docsUrl: "https://ptv.vic.gov.au/ptv-timetable-api",
};
