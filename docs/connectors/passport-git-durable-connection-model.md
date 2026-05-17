# Passport Git Durable Connection Model

**Status:** Scope model for implementation
**Owner:** UnClick Connectors
**Related docs:** `docs/connectors/spec.md`, `docs/connectors/migration-plan.md`, `docs/connectors/phase-1-plan.md`

## Intent

Passport Git should let Chris connect GitHub once, then use that same connection from every UnClick seat and every trusted device without making a new key per machine.

The user-facing promise is simple:

> Connect GitHub once. UnClick can use it anywhere you approve, until you revoke it.

This document defines the safe model only. It does not change live credentials, OAuth apps, production rows, secrets, or runtime behavior.

## First Implementation Lane

Phase 2 GitHub OAuth is the first implementation lane.

GitHub starts as the proof connector because it is already the first OAuth target in `docs/connectors/spec.md`, it is central to UnClick build work, and the current frontend connector registry already treats GitHub as OAuth-first with a manual token fallback.

## Storage Boundary

The durable connection belongs to the user, not to a single laptop, browser tab, AI client, or worker seat.

The storage boundary should be:

- one user-level GitHub connection record
- encrypted token material stored only in the trusted server credential layer
- metadata visible to UI and agents, such as provider, scopes, status, owner, last tested time, and revoke state
- no raw token values exposed in Boardroom, Orchestrator, logs, comments, screenshots, or agent prompts

The connection record should be usable by approved UnClick tools, but the secret value itself should stay behind the credential broker. Agents ask for a GitHub action. They do not receive a portable GitHub token.

## Cross-Device Model

A new device should not generate a new GitHub credential by default.

Expected flow:

1. Chris signs into UnClick on a second device.
2. UnClick shows that GitHub is already connected.
3. The device can request agent work that uses GitHub through the existing user-level connection.
4. If extra trust is needed later, UnClick can add a local approval step, but it should still reuse the same GitHub connection record.

The durable thing is the UnClick user connection, not a per-device key.

## Reconnect Path

Reconnect means replacing or refreshing the user-level connection, not creating an unrelated second credential.

Expected flow:

1. GitHub access fails, expires, or loses required scopes.
2. UnClick marks the connection as needs attention.
3. Chris chooses Reconnect.
4. GitHub OAuth runs again.
5. The existing connection record is updated with the new token material and scope metadata.
6. Jobs that were blocked on GitHub can retry after the connection passes a health check.

Reconnect should preserve job history and proof trails. It should not make past jobs look like they used a different connection unless the provider account actually changed.

## Revoke Path

Revoke should stop every seat and device from using GitHub through UnClick.

Expected flow:

1. Chris chooses Disconnect or Revoke in UnClick.
2. UnClick marks the GitHub connection revoked locally.
3. UnClick attempts provider-side revocation when the provider supports it.
4. Any cached access token is deleted or made unusable.
5. Agent tools see GitHub as disconnected and must stop.
6. Jobs that require GitHub move to a clear blocked state.

Revocation must win over convenience. If local state says revoked, no worker should continue by using stale cached token material.

## Agent Usage Path

Agents should use GitHub through UnClick, not by copying credentials around.

Expected path:

1. A seat requests a scoped GitHub action, such as read PR status, create a branch, comment on a PR, or inspect checks.
2. UnClick checks the user connection, scopes, job policy, and safety rules.
3. The GitHub tool performs the action server-side using the brokered connection.
4. The agent receives only the action result and proof receipt.
5. Orchestrator and Boardroom store the decision, action summary, and proof link, not the token.

This keeps UnClick as the traffic controller, proof layer, and safety layer while still letting UnClick build and code through approved tools.

## Manual Token Fallback

Manual GitHub tokens remain a fallback, not the preferred path.

Use manual token fallback when:

- OAuth is not available yet in the current environment
- a GitHub app setup is temporarily blocked
- a narrow maintenance task needs a scoped token that Chris explicitly provided

Fallback rules:

- label the connection as manual token fallback
- store the token behind the same encrypted credential boundary
- show the token as secret-only, never plain text
- keep scope and rotation metadata visible
- prefer replacing fallback with OAuth once Phase 2 is ready

## Follow-Up Build Chips

This model should split into smaller implementation chips:

1. UI chip: Connections page shows GitHub connected, needs attention, reconnect, and revoke states.
2. API chip: server endpoints expose list, health check, reconnect start, OAuth callback, and revoke.
3. MCP chip: agent-facing tools use the brokered connection and return proof receipts.
4. Policy chip: job runners stop cleanly when GitHub is revoked or missing scope.
5. Migration chip: any old manual GitHub credential is labelled as fallback and moved only after an explicit safety pass.

## Non-Goals

This chip does not:

- register or change a real GitHub OAuth app
- write production database rows
- migrate secrets
- reveal credentials
- change GitHub Actions secrets
- change billing, DNS, domains, or deploy config
- replace the full Connections architecture in `docs/connectors/spec.md`
- build the UI, API, or MCP runtime behavior

## Done Condition

The next builder should be able to create the UI, API, and MCP chips from this model without asking Chris what Passport Git means.

The correct direction is:

- one durable user-level GitHub connection
- OAuth-first
- manual token fallback only when needed
- shared safely across trusted seats and devices
- revoked everywhere when Chris disconnects it
- no raw token copied into worker prompts or logs
