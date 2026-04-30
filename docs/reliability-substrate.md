# Reliability Substrate

The reliability substrate gives the 🤖 fleet a durable way to hand work between agents without relying on chat alone. It lives behind `/api/memory-admin` and is keyed by your tenant's `UNCLICK_API_KEY`.

## Concepts

- **Dispatch.** A unit of work directed at a target agent. It carries `source` (which tool created it), `target_agent_id`, optional `task_ref`, and a free-form `payload`. A dispatch lives in `mc_agent_dispatches` with a deterministic `dispatch_id` so two callers with the same input idempotently create the same row.
- **Heartbeat.** A periodic note from the working agent that records `state` (`idle | received | accepted | working | blocked | completed`), the current task, next action, ETA, and any blocker. Heartbeats land in `mc_agent_heartbeats` and double as the dispatch's `last_real_action_at` timestamp.
- **Lease.** When an agent claims a dispatch it becomes the `lease_owner` until `lease_expires_at`. Only the lease owner can publish heartbeats against the dispatch or release it. Leases default to 900s and clamp to 86400s.
- **Stale reclaim.** A janitor sweeps leases whose `lease_expires_at` is in the past, flips the dispatch to `status=stale`, clears the owner, and emits a WakePass signal so a human or watchdog can pick it back up.

## Action map

The substrate is exposed as URL-routed actions on `POST /api/memory-admin?action=...&method=...`. The friendly names below are how the fleet talks about them; the API column is what you actually call.

| Friendly name | API call | What it does |
|---|---|---|
| `dispatch_create` | `reliability_dispatches&method=upsert` | Creates a queued dispatch (idempotent on `dispatch_id`). |
| `dispatch_ack` | `reliability_dispatches&method=claim` | Claims the lease for an `agent_id`. |
| `dispatch_heartbeat` | `reliability_heartbeats&method=publish` | Publishes a state update from the lease owner. |
| `dispatch_complete` | `reliability_heartbeats&method=publish` with `state=completed` | Publishes a terminal heartbeat and marks the dispatch completed. |
| `dispatch_fail` | `reliability_dispatches&method=release` with `status=failed` | Releases the lease and marks the dispatch failed. |
| `dispatch_reclaim_stale` | `reliability_reclaim_stale` | Sweeps expired leases; emits WakePass signals. |

All requests need `Authorization: Bearer $UNCLICK_API_KEY`. Responses are JSON; errors return `{ "error": "..." }` with a 4xx status.

### `dispatch_create`

Request:
```json
{
  "source": "wakepass",
  "target_agent_id": "agent_qa_1",
  "task_ref": "ticket-1234",
  "payload": { "note": "validate substrate" }
}
```
Response: `{ "data": <dispatch row>, "was_duplicate": false }`. Returns `400` if `source` is invalid or `target_agent_id` is missing. Duplicate `dispatch_id` returns `200` with `was_duplicate: true`.

### `dispatch_ack`

Request:
```json
{ "dispatch_id": "dispatch_...", "agent_id": "agent_qa_1", "lease_seconds": 900 }
```
Response: `{ "data": <dispatch row>, "reclaimed_stale_lease": false }`. Rejection codes:
- `400` if `dispatch_id` or `agent_id` is missing.
- `404` if the dispatch does not exist.
- `409` if the dispatch is already `completed | failed | cancelled`, already actively leased by someone else, or another writer raced ahead.

### `dispatch_heartbeat`

Request:
```json
{
  "dispatch_id": "dispatch_...",
  "agent_id": "agent_qa_1",
  "state": "working",
  "current_task": "running smokes",
  "next_action": "post results",
  "eta_minutes": 5
}
```
Response: `{ "data": <heartbeat row> }`.

**Strict ownership rule.** Heartbeat publish always returns `409` if `dispatch.status === "leased"` AND `dispatch.lease_owner` is set AND `dispatch.lease_owner !== agent_id`, regardless of whether the lease has expired. Stale handling lives in `dispatch_reclaim_stale` only — heartbeat publish never reclaims, so a paused agent can not silently overwrite another agent's lease.

Other rejection codes: `400` (missing `agent_id` or invalid `state`), `404` (unknown `dispatch_id`), `409` (dispatch row changed between read and write).

### `dispatch_complete`

Same shape as `dispatch_heartbeat` with `state: "completed"`. The dispatch row is updated to `status=completed` with `lease_owner=null` and `lease_expires_at=null` in the same transaction as the heartbeat insert.

### `dispatch_fail`

Request:
```json
{ "dispatch_id": "dispatch_...", "agent_id": "agent_qa_1", "status": "failed" }
```
Response: `{ "data": <dispatch row> }`. Status defaults to `queued` if omitted; `leased` is rejected with `400`. Returns `409` if another agent owns the lease.

### `dispatch_reclaim_stale`

Request:
```json
{ "limit": 25, "dry_run": false }
```
Response: `{ "reclaimed_count": N, "reclaimed": [...], "dry_run": false }`. Each reclaim emits a WakePass signal — `handoff_ack_missing` when the dispatch payload expected an ACK, otherwise `stale_dispatch_reclaimed`.

## Curl examples

```bash
BASE=https://unclick.world/api/memory-admin
TOK="Authorization: Bearer $UNCLICK_API_KEY"

# create
curl -sS -X POST "$BASE?action=reliability_dispatches&method=upsert" \
  -H "$TOK" -H 'content-type: application/json' \
  -d '{"source":"manual","target_agent_id":"agent_qa_1","task_ref":"smoke-1"}'

# ack
curl -sS -X POST "$BASE?action=reliability_dispatches&method=claim" \
  -H "$TOK" -H 'content-type: application/json' \
  -d '{"dispatch_id":"dispatch_...","agent_id":"agent_qa_1"}'

# heartbeat
curl -sS -X POST "$BASE?action=reliability_heartbeats&method=publish" \
  -H "$TOK" -H 'content-type: application/json' \
  -d '{"dispatch_id":"dispatch_...","agent_id":"agent_qa_1","state":"working"}'

# complete
curl -sS -X POST "$BASE?action=reliability_heartbeats&method=publish" \
  -H "$TOK" -H 'content-type: application/json' \
  -d '{"dispatch_id":"dispatch_...","agent_id":"agent_qa_1","state":"completed"}'

# fail (alternative terminal state)
curl -sS -X POST "$BASE?action=reliability_dispatches&method=release" \
  -H "$TOK" -H 'content-type: application/json' \
  -d '{"dispatch_id":"dispatch_...","agent_id":"agent_qa_1","status":"failed"}'

# reclaim stale
curl -sS -X POST "$BASE?action=reliability_reclaim_stale" \
  -H "$TOK" -H 'content-type: application/json' \
  -d '{"limit":25,"dry_run":true}'
```

## Running the smoke script

```bash
export UNCLICK_API_URL=https://unclick.world/api/memory-admin   # defaults to this
export UNCLICK_API_KEY=uc_...                                   # tenant key
bash scripts/smoke-reliability.sh
```

The script generates a fresh idempotency key per run, walks the happy path (`create → ack → heartbeat → complete`) plus an optional `fail` and `reclaim_stale` pass, prints PASS/FAIL with the HTTP status per action, and exits `0` only if every action passes. See `scripts/smoke-reliability.sh` for the source.
