import type { ConnectorConfig } from "./index.js";

export const lastfmConnector: ConnectorConfig = {
  name:     "Last.fm",
  slug:     "lastfm",
  authType: "api_key",
  description:
    "Last.fm music data API. Get artist info, top tracks, similar artists, album details, and global music charts. Unlimited free read access.",
  credentialFields: [
    {
      key:         "api_key",
      label:       "API Key",
      description: "Last.fm API key. Free to obtain from your Last.fm account settings.",
      secret:      true,
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      findGuideUrl: "https://www.last.fm/api/account/create",
    },
  ],
  docsUrl: "https://www.last.fm/api",
};
