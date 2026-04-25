# PRD: BackstagePass

**Status**: Shipped. Vault live at `api/backstagepass.ts`. Proof-of-possession auth enforced.
**Last updated**: 2026-04-25.

## Problem statement

Agents need credentials to do real work. A user who wants Claude to post to Slack, read their Xero books, or list their Shopify orders has to hand an API key or OAuth token to their agent. Today that happens through one of three bad paths: typing the key into the chat (leaked to the model provider), pasting it into a config file (leaked to the harness), or wiring a server-side integration per tool (not portable).

The credentials belong to the user. The agent needs them just-in-time, not always, and every access should be auditable. A vault purpose-built for agent-mediated access is the missing piece.

## Target user

- **Agent-native users connecting real business tools.** Anyone who wants their agent to act on Stripe, Slack, Gmail, Xero, GitHub, Shopify, Notion, and the 50+ other connectors UnClick supports.
- **Privacy-aware users.** People who understand that a token in a config file on a harness machine is a liability.
- **Developers submitting tools to the marketplace.** Marketplace tools must read credentials through BackstagePass, never through ambient env vars.

## Core capabilities

1. **Encrypted credential vault.** AES-256-GCM at rest with a per-row IV and auth tag. PBKDF2 key derivation from the user's own api_key. UnClick staff cannot decrypt user credentials.
2. **Proof-of-possession auth.** Reveal requires the Supabase session JWT **and** the plaintext api_key in the body, compared with a timing-safe equality check. A stolen JWT alone cannot unlock the vault.
3. **Full audit log.** Every list, reveal, update, and delete writes `backstagepass_audit` with actor, action, credential name, and timestamp. The log is append-only at the RLS layer.
4. **Scoped RLS.** `user_credentials` has `block_anon_access` and `block_authenticated_direct_access` policies. Only service_role with a verified tenant context can touch the rows.
5. **CORS restricted.** The endpoint accepts requests only from `https://unclick.world`. No wildcard origins on credential traffic.
6. **Per-tenant scoping.** Every read and write adds `.eq("api_key_hash", hash)` on top of RLS. Defence-in-depth at both layers.

## Success metrics

- **Vault fill rate.** Number of credentials stored per active tenant. A tenant with 0 credentials has not moved real work onto the platform.
- **Reveal events.** Rate of successful reveals. A sudden spike is a product signal; a sudden spike on one tenant is a security signal.
- **Zero cross-tenant reveal incidents.** The blocker metric. Any cross-tenant reveal is a full-stop incident.
- **Audit coverage.** 100 percent of destructive actions logged. Currently at 100 percent for BackstagePass; enforced by service-side contract.

## Out-of-scope

- **We do not proxy credential usage.** BackstagePass stores and reveals; it does not broker the outbound API call. The calling tool uses the revealed credential directly.
- **We do not support shared team vaults in this phase.** Each vault is per-tenant. Team sharing is a future phase.
- **We do not rotate credentials automatically.** Rotation is the provider's responsibility; BackstagePass supports rotation by update but does not initiate it.
- **We do not store credentials without encryption.** There is no plaintext-at-rest mode, even for debug.

## Key decisions and why

- **AES-256-GCM with PBKDF2, not KMS.** The encryption key is derived from the user's own api_key. Losing the api_key means losing access to the vault, which is the correct security posture for a proof-of-possession system. A managed KMS would make UnClick staff able to decrypt, which we deliberately do not want.
- **Reveal requires JWT and api_key.** Single-factor access was ruled out. A JWT alone proves browser session possession but not device possession; pairing it with the api_key binds reveal to an artefact the user controls.
- **Timing-safe compare on api_key.** Constant-time comparison resists timing attacks. The api_key is a secret; leaking it bit-by-bit through response timing is the class of bug BackstagePass was designed to prevent.
- **Full audit log, no exceptions.** Destructive-write-without-log is a repudiation risk. The audit surface exists so incident response has a trail.
- **No multi-factor on reveal in v1.** The combination of JWT plus api_key plus timing-safe compare plus scoped CORS is judged sufficient for the current threat model. Adding second-factor confirmation is on the roadmap as the vault scales.

## Platform philosophy alignment

- **Idiot-proof UX.** The BackstagePass page presents credentials as cards. Add, reveal, rotate, delete. No concepts like IV, salt, or GCM auth tag reach the user. The complexity is fully hidden.
- **Subscription-based (no LLM billing).** BackstagePass is priced by vault size in the platform tier. It never touches the user's LLM provider relationship.
- **MCP-first.** Credentials are retrievable through `unclick_call` with the BackstagePass endpoint. Agents list and reveal credentials using the same meta-tool surface they use for everything else. The web UI is a human convenience, not a parallel path.
