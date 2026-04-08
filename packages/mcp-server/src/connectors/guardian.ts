import type { ConnectorConfig } from "./index.js";

export const guardianConnector: ConnectorConfig = {
  name:     "The Guardian",
  slug:     "guardian",
  authType: "api_key",
  description:
    "The Guardian Open Platform API. Search and retrieve full article text, browse sections, and explore content tags. Free tier includes full body text.",
  credentialFields: [
    {
      key:         "api_key",
      label:       "API Key",
      description: "Guardian Open Platform API key. Free registration gives full article access.",
      secret:      true,
      placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      findGuideUrl: "https://open-platform.theguardian.com/access/",
    },
  ],
  docsUrl: "https://open-platform.theguardian.com/documentation/",
};
