import type { ConnectorConfig } from "./index.js";

export const newsapiConnector: ConnectorConfig = {
  name:     "NewsAPI",
  slug:     "newsapi",
  authType: "api_key",
  description:
    "NewsAPI aggregates headlines and articles from 80,000+ sources worldwide. Search news by keyword, date, and language, or browse top headlines by country and category.",
  credentialFields: [
    {
      key:         "api_key",
      label:       "API Key",
      description: "NewsAPI key. Free developer tier available with registration.",
      secret:      true,
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      findGuideUrl: "https://newsapi.org/register",
    },
  ],
  docsUrl: "https://newsapi.org/docs",
};
