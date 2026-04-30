# Reliability Substrate Slice 1 -- Smoke Test Checklist

This is the first operator-facing validation pass for the reliability substrate
landed in PR `#312`.

Scope covered here:

- `reliability_dispatches`
- `reliability_heartbeats`
- `reliability_reclaim_stale`

Out of scope:

- WakePass UI
- dashboard or reporting surfaces
- Connections follow-on state

## Prerequisites

- a valid UnClick API key
- a reachable deployment or local server exposing `/api/memory-admin`
- bearer auth available as `Authorization: Bearer <api_key>`

Example shell setup:

```bash
export UNCLICK_API_KEY="..."
export UNCLICK_BASE_URL="https://unclick.world"
```

## 1. Dispatch upsert is idempotent

Create one dispatch:

```bash
curl -sS "$UNCLICK_BASE_URL/api/memory-admin?action=reliability_dispatches&method=upsert" \
  -X POST \
  -H "Authorization: Bearer $UNCLICK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "fishbowl",
    "target_agent_id": "worker-alpha",
    "task_ref": "todo-fe443a8a",
    "prompt_hash": "smoke-1",
    "payload": {
      "route": "smoke",
      "ack_required": true
    }
  }'
```

Verify:

- response is `200`
- `was_duplicate` is `false`
- a `dispatch_id` is returned

Repeat the exact same request.

Verify:

- response is still `200`
- `was_duplicate` is `true`
- returned `dispatch_id` matches the first response

Optional list check:

```bash
curl -sS "$UNCLICK_BASE_URL/api/memory-admin?action=reliability_dispatches&method=list&target_agent_id=worker-alpha&limit=5" \
  -H "Authorization: Bearer $UNCLICK_API_KEY"
```

## 2. Lease ownership is enforced

Claim the dispatch as `worker-alpha`:

```bash
curl -sS "$UNCLICK_BASE_URL/api/memory-admin?action=reliability_dispatches&method=claim" \
  -X POST \
  -H "Authorization: Bearer $UNCLICK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dispatch_id": "<dispatch_id>",
    "agent_id": "worker-alpha",
    "lease_seconds": 120
  }'
```

Verify:

- response is `200`
- `status` is `leased`
- `lease_owner` is `worker-alpha`

Try to publish a heartbeat from a different worker while the lease is active:

```bash
curl -sS "$UNCLICK_BASE_URL/api/memory-admin?action=reliability_heartbeats&method=publish" \
  -X POST \
  -H "Authorization: Bearer $UNCLICK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dispatch_id": "<dispatch_id>",
    "agent_id": "worker-bravo",
    "state": "working",
    "current_task": "should fail",
    "next_action": "none"
  }'
```

Verify:

- response is `409`
- error says the dispatch is leased by another agent

Now publish as the real lease owner:

```bash
curl -sS "$UNCLICK_BASE_URL/api/memory-admin?action=reliability_heartbeats&method=publish" \
  -X POST \
  -H "Authorization: Bearer $UNCLICK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dispatch_id": "<dispatch_id>",
    "agent_id": "worker-alpha",
    "state": "working",
    "current_task": "smoke validation",
    "next_action": "release"
  }'
```

Verify:

- response is `200`
- heartbeat row is returned

Release the lease:

```bash
curl -sS "$UNCLICK_BASE_URL/api/memory-admin?action=reliability_dispatches&method=release" \
  -X POST \
  -H "Authorization: Bearer $UNCLICK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dispatch_id": "<dispatch_id>",
    "agent_id": "worker-alpha",
    "status": "queued"
  }'
```

Verify:

- response is `200`
- `lease_owner` is `null`
- `lease_expires_at` is `null`

## 3. Reclaim stale lease emits the right evidence

Create and claim a second dispatch with explicit ACK metadata:

```bash
curl -sS "$UNCLICK_BASE_URL/api/memory-admin?action=reliability_dispatches&method=upsert" \
  -X POST \
  -H "Authorization: Bearer $UNCLICK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "fishbowl",
    "target_agent_id": "worker-charlie",
    "task_ref": "wakepass-no-ack-smoke",
    "payload": {
      "ack_required": true,
      "handoff_message_id": "msg-smoke-1"
    }
  }'
```

Claim it with a very short lease:

```bash
curl -sS "$UNCLICK_BASE_URL/api/memory-admin?action=reliability_dispatches&method=claim" \
  -X POST \
  -H "Authorization: Bearer $UNCLICK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dispatch_id": "<stale_dispatch_id>",
    "agent_id": "worker-charlie",
    "lease_seconds": 1
  }'
```

Wait two seconds, then dry-run reclaim:

```bash
curl -sS "$UNCLICK_BASE_URL/api/memory-admin?action=reliability_reclaim_stale" \
  -X POST \
  -H "Authorization: Bearer $UNCLICK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dry_run": true,
    "limit": 10
  }'
```

Verify:

- the stale dispatch appears in `reclaimed`
- `action` is `handoff_ack_missing`
- `dry_run` is `true`

Run the real reclaim:

```bash
curl -sS "$UNCLICK_BASE_URL/api/memory-admin?action=reliability_reclaim_stale" \
  -X POST \
  -H "Authorization: Bearer $UNCLICK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dry_run": false,
    "limit": 10
  }'
```

Verify:

- the stale dispatch is returned again
- `action` is still `handoff_ack_missing`
- a follow-up `reliability_dispatches get` shows `status: "stale"`
- the matching `mc_signals` row exists with tool `wakepass`

## Expected operator takeaway

This slice is healthy when:

- duplicate dispatch creation collapses to one shared `dispatch_id`
- only the lease owner can publish heartbeat progress for a leased dispatch
- stale recovery happens through reclaim or re-claim, not through heartbeat writes
- ACK-missing handoffs surface as explicit WakePass evidence instead of vanishing as generic stale work
