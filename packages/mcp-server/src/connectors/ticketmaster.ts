import type { ConnectorConfig } from "./index.js";

export const ticketmasterConnector: ConnectorConfig = {
  name:     "Ticketmaster",
  slug:     "ticketmaster",
  authType: "api_key",
  description:
    "Ticketmaster Discovery API. Search events by keyword, city, and date, find venues, and look up attractions worldwide.",
  credentialFields: [
    {
      key:         "api_key",
      label:       "API Key",
      description: "Ticketmaster Developer API key. Free tier available with registration.",
      secret:      true,
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      findGuideUrl: "https://developer.ticketmaster.com/products-and-docs/apis/getting-started/",
    },
  ],
  docsUrl: "https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/",
};
