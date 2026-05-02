# Ad Platform MCP Watch

**Status:** Watch / parking-lot note
**Last updated:** 2026-05-02
**Owner:** Connectors / RotatePass
**Related products:** Connections, RotatePass, EnterprisePass, WakePass, future AdPass

## Intent

Meta Ads AI connector news is a market signal, not an immediate build mandate.

Ad platforms moving toward MCP access means campaign operations are likely to become agent-addressable: reporting, diagnosis, creative review, budget checks, and eventually controlled changes from AI tools.

UnClick should keep this in the Connectors fence so the idea is not lost, but it should not distract from the current ring-fencing work.

## Where this sits

This belongs under **Connectors / RotatePass** first.

It should not start as a broad new Pass or browser extension. The first useful shape is:

- connect an ad account safely
- prove the connection is healthy
- show which workflows depend on it
- run read-only checks
- require human approval before spend-changing actions
- produce receipts for any action taken

If the lane proves useful later, it can become **AdPass** or an XPass-selected check. Until then, keep it as an ad-platform connector watch item.

## Why it matters

Ad accounts are high-value, high-risk systems:

- they move real money
- mistakes can burn budget quickly
- customer audiences and pixels may contain sensitive business data
- platform permissions are account-specific and can be hard to reason about
- investors and operators will care about approval trails

That makes the opportunity real, but also means the guardrails matter more than speed.

## Phase 0 position

Do now:

- track official ad-platform MCP support
- note the connector requirements
- keep docs aligned with the Connectors safety model
- consider future read-only campaign-health receipts

Do not do yet:

- build a live Meta Ads integration
- request advertiser credentials
- store raw ad-account secrets
- give agents ungated write access to campaigns
- let an agent change budgets, audiences, creative, status, or catalog data without human approval

## Safe first use cases

The first product slice should be read-only:

- campaign health summary
- spend anomaly detection
- CPA / ROAS drift check
- broken pixel or tracking warning
- creative fatigue signal
- budget pacing warning
- disconnected account or expired permission warning

These fit existing UnClick rails:

- **Connections** shows whether the ad platform is connected.
- **RotatePass** shows credential health, owner, last checked, and rotation notes.
- **WakePass** alerts a worker or human when spend or tracking breaks.
- **EnterprisePass** checks whether approval and audit trails exist.
- **XPass** can later include ad-account readiness as one selected check.

## Write-action rules

Any action that can alter spend or delivery must be staged first.

Allowed only after explicit approval:

- pause or restart campaign
- change daily or lifetime budget
- change campaign, ad set, or ad status
- change targeting or audience
- upload or swap creative
- edit catalog, pixel, conversion, or tracking settings

Every approved write action must produce a receipt:

- who requested it
- who approved it
- target account and campaign
- before state
- after state
- timestamp
- provider response or action ID where available

## Credential rules

Do not store raw credentials.

Prefer provider OAuth or provider-hosted MCP auth when available. If a provider gives an MCP URL or scoped connection token, treat it like a high-value system credential:

- never print it
- never log it
- never show it in Fishbowl
- show only safe metadata
- map it to owner, usage, health, and rotation notes

## Product naming

Do not rush the name.

Working terms:

- **Ad platform connector** for the immediate lane
- **Ad readiness check** for XPass/reporting language
- **AdPass** only if it becomes a real scoped product later

Avoid implying UnClick is an ad agency or autonomous campaign manager.

## Open questions

- Which providers expose official MCP or OAuth-based agent access?
- Which access scopes are read-only versus write-capable?
- Can provider-side approvals or review drafts be enforced?
- What audit trail does each provider return?
- Does the provider support per-user revocation without breaking shared business assets?

## References to verify before implementation

- Meta Business announcement: `https://www.facebook.com/business/news/meta-ads-ai-connectors`
- Anthropic MCP connector docs: `https://docs.claude.com/en/docs/agents-and-tools/mcp-connector`

## Recommendation

Park this as a strategic watch item.

Do not spend build time until one of these is true:

1. UnClick has its own ad-account workflow to dogfood.
2. A user asks to connect an ad platform.
3. Connectors/RotatePass has enough credential-health plumbing to display it safely.
4. The provider documentation is stable enough to implement without guesswork.
