import type { ConnectorConfig } from "./index.js";

export const twitchConnector: ConnectorConfig = {
  name:     "Twitch",
  slug:     "twitch",
  authType: "api_key",
  description:
    "Twitch Helix API. Search streams, get live channel info, browse games, retrieve clips, and fetch channel schedules.",
  credentialFields: [
    {
      key:         "client_id",
      label:       "Client ID",
      description: "Twitch application Client ID from the Twitch Developer Console.",
      secret:      false,
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      findGuideUrl: "https://dev.twitch.tv/docs/authentication/register-app/",
    },
    {
      key:         "client_secret",
      label:       "Client Secret",
      description: "Twitch application Client Secret. Used to obtain app access tokens via the Client Credentials grant.",
      secret:      true,
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      findGuideUrl: "https://dev.twitch.tv/docs/authentication/register-app/",
    },
  ],
  docsUrl: "https://dev.twitch.tv/docs/api/",
};
