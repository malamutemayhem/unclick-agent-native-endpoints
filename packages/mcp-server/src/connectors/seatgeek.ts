import type { ConnectorConfig } from "./index.js";

export const seatgeekConnector: ConnectorConfig = {
  name:     "SeatGeek",
  slug:     "seatgeek",
  authType: "api_key",
  description:
    "SeatGeek Platform API. Search events, performers, and venues. Get ticket availability and pricing for concerts, sports, and theatre.",
  credentialFields: [
    {
      key:         "client_id",
      label:       "Client ID",
      description: "SeatGeek API client ID. Register at platform.seatgeek.com to get credentials.",
      secret:      false,
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      findGuideUrl: "https://platform.seatgeek.com/",
    },
  ],
  docsUrl: "https://platform.seatgeek.com/",
};
