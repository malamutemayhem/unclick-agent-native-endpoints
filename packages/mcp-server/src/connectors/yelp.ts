import type { ConnectorConfig } from "./index.js";

export const yelpConnector: ConnectorConfig = {
  name:     "Yelp",
  slug:     "yelp",
  authType: "api_key",
  description:
    "Yelp Fusion API. Search local businesses by location, category, and price. Get business details, read reviews, find local events, and use autocomplete for search UIs.",
  credentialFields: [
    {
      key:         "api_key",
      label:       "API Key",
      description: "Yelp Fusion API key. Obtain from the Yelp Developer Console after creating an app.",
      secret:      true,
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      findGuideUrl: "https://docs.developer.yelp.com/docs/fusion-intro",
    },
  ],
  docsUrl: "https://docs.developer.yelp.com/docs/fusion-intro",
};
