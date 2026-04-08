import type { ConnectorConfig } from "./index.js";

export const discogsConnector: ConnectorConfig = {
  name:     "Discogs",
  slug:     "discogs",
  authType: "api_key",
  description:
    "Discogs music database API. Search releases, get artist and label details, and check marketplace pricing stats for vinyl and physical media.",
  credentialFields: [
    {
      key:         "token",
      label:       "Personal Access Token",
      description: "Discogs personal access token. Generate one from your Discogs account developer settings.",
      secret:      true,
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      findGuideUrl: "https://www.discogs.com/settings/developers",
    },
  ],
  docsUrl: "https://www.discogs.com/developers",
};
