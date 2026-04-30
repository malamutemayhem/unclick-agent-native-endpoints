# WakePass Product Brief

**Status**: Greenlit for build after the reliability substrate and Connections Phase 1
**Date**: 2026-04-30
**Public Pass name**: WakePass
**Core engine name**: PinballWake
**Related docs**: ADR-0011, ADR-0010, Connectors Phase 0

## One-line promise

WakePass wakes the right AI worker, proves the wake landed, and only escalates if it did not.

## Naming boundary

WakePass and PinballWake are not competing products.

| Name | Public role | Owns |
|---|---|---|
| WakePass | Public Pass-family product | Dashboard, onboarding, billing, route packs, reports, Pass integrations |
| PinballWake | Reusable tool engine | Wake routing, bounce ladder, ACK receipts, heartbeats, leases, route adapters |
| Doorbell | Feature primitive | Cheap classifier for ignore, queue, or wake now |
| ACK receipt | Proof primitive | Signed proof the worker saw and accepted the wake |
| Pinball replay | Debug feature | Route timeline and replay of wake attempts |

Use this phrasing in product copy:

> WakePass by UnClick, powered by PinballWake.

## Why now

UnClick is about to increase the number of automated runs through Connectors, Fishbowl, and the Pass family. More automation creates more silent failures:

- expired credentials
- missed check-ins
- stale worker status
- duplicate dispatch
- abandoned tasks
- browser sessions that look alive but are unusable
- webhooks delivered to an endpoint but not to a reasoning worker

WakePass turns those failures into a visible ACK-or-escalate loop.

## Customer

The first customer is a technical operator running AI workers across:

- GitHub
- Fishbowl
- MCP clients
- Connectors
- Pass products
- scheduled or background tasks

The buyer does not want another agent framework. They want proof that work started, proof that a worker is alive, and a clean recovery path when it is not.

## Product shape

WakePass is a thin product wrapper over the shared reliability substrate and PinballWake engine.

The first public surface includes:

- fleet health dashboard
- wake event log
- signed receipt view
- route policy editor
- stuck-run recovery button
- connector health awareness
- Pass-family integrations

The first product should not include:

- a node-based workflow builder
- full browser automation
- broad agent orchestration
- custom code execution
- live animated pinball UI
- human on-call replacement

## Build order

### 1. Reliability substrate

Required before WakePass code:

- idempotent dispatch IDs
- heartbeats
- task leases
- stale reclaim
- duplicate detection
- queue and last-real-action telemetry

### 2. Connections Phase 1

Required before routing gets broad:

- connected, needs reconnection, connection error, setup incomplete, not connected
- setup metadata
- connection health probes
- status reasons
- RotatePass-ready stale-token state

### 3. PinballWake engine

First engine slice:

- wake event schema
- route ladder schema
- route adapter interface
- heartbeat publish path
- ACK receipt schema
- retry and budget caps
- stale lease recovery path

### 4. WakePass wrapper

First product slice:

- fleet dashboard
- stuck-run recovery action
- wake receipt view
- wake event log
- first TestPass, UXPass, or FlowPass integration

## MVP route ladder

Start with five routes:

1. Fishbowl assignment
2. GitHub issue or PR comment
3. signed webhook to a worker endpoint
4. Slack or Discord ping
5. human-facing Signals fallback

Browser extension routes come later through UnClick Local.

## ACK schema

The first ACK object should include:

| Field | Purpose |
|---|---|
| `wake_id` | Wake event ID |
| `dispatch_id` | Shared idempotency key |
| `worker_id` | Worker that responded |
| `state` | received, accepted, working, blocked, completed |
| `current_task` | Short task label |
| `next_action` | What happens next |
| `eta_minutes` | Optional ETA |
| `blocker` | Optional blocker |
| `route_used` | Route that landed |
| `received_at` | Timestamp |
| `receipt_signature` | Later signed proof |

Signatures can ship after the unsigned ACK shape is proven.

## Pass-family hooks

| Pass | First WakePass hook |
|---|---|
| TestPass | Re-wake a stuck test runner |
| UXPass | Recover a quiet browser or Stagehand run |
| FlowPass | Reassign a stalled flow step |
| SecurityPass | Wake a scheduled rescan |
| BackstagePass or RotatePass | Wake an owner for stale or expiring connector credentials |

## Success metrics

The MVP is working when:

- p50 wake-to-ACK is under 15 seconds on configured routes.
- duplicate dispatches trend toward zero.
- stale worker state is visible within one check-in window.
- a stuck run can be recovered from a Pass surface without manual cross-tool hunting.
- every wake attempt has a route history.
- every failed wake has a clear next route or human fallback.

## Launch copy

Primary headline:

> Wake the right AI worker in seconds. Prove it landed.

Supporting line:

> WakePass uses PinballWake to route, retry, and prove AI worker wakeups across your UnClick fleet.

Short dashboard copy:

> This run looks stuck. WakePass can re-wake the worker and show a receipt when it lands.

## Risks

| Risk | Mitigation |
|---|---|
| Wake loops | Mandatory idempotency keys and stop on first valid ACK |
| Cost runaway | Per-wake retry, elapsed time, and spend caps |
| Secret leakage | Metadata-first payloads and route sanitisation |
| Spam | Per-route and per-tenant rate limits |
| Browser fragility | Keep browser routes out of v1 |
| Product confusion | WakePass is the product, PinballWake is the engine |

## First issue to file

Title:

> Build reliability substrate helpers for dispatch IDs, heartbeats, leases, and stale reclaim

Scope:

- typed dispatch and heartbeat shapes
- deterministic dispatch ID helper
- stale lease decision helper
- unit tests
- no migration in the first helper PR

Out of scope:

- database migration
- WakePass UI
- route adapters
- browser extension
- billing
