-- Install tickets: short-lived handoff codes that the MCP server exchanges
-- for a real UnClick API key on first boot. Single-use, 24h TTL.
--
-- Flow:
--   1. Website calls /api/install-ticket?action=issue with the user's api_key
--      and gets back { ticket: "unclick-ember-falcon-2847", expires_at }.
--   2. User pastes a config containing the ticket into their MCP client.
--   3. MCP server boots, sees ticket-shaped env var, calls
--      /api/install-ticket?action=redeem with { ticket }, receives the real
--      api_key, caches it locally so future boots skip the redeem step.
--   4. Redemption marks the row as consumed; a second redeem returns an error.

CREATE TABLE IF NOT EXISTS install_tickets (
  ticket        TEXT        PRIMARY KEY,
  api_key       TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  redeemed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_install_tickets_api_key
  ON install_tickets(api_key);

CREATE INDEX IF NOT EXISTS idx_install_tickets_expires
  ON install_tickets(expires_at)
  WHERE redeemed_at IS NULL;

ALTER TABLE install_tickets ENABLE ROW LEVEL SECURITY;

-- No direct client access; all reads/writes go through service-role in
-- /api/install-ticket.
CREATE POLICY "No direct access" ON install_tickets
  USING (false)
  WITH CHECK (false);
