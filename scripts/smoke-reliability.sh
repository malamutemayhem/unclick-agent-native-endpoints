#!/usr/bin/env bash
# Smoke-test the reliability substrate (dispatch_create -> ack -> heartbeat ->
# complete, plus optional fail + reclaim_stale). Reads UNCLICK_API_URL and
# UNCLICK_API_KEY from env. Exits 0 on full pass, 1 on any failure.
set -uo pipefail

BASE="${UNCLICK_API_URL:-https://unclick.world/api/memory-admin}"
TOKEN="${UNCLICK_API_KEY:-}"
if [[ -z "$TOKEN" ]]; then
  echo "FAIL setup: UNCLICK_API_KEY not set" >&2
  exit 1
fi

if command -v uuidgen >/dev/null 2>&1; then
  RUN_ID="$(uuidgen | tr 'A-Z' 'a-z')"
else
  RUN_ID="$(date +%s)-$RANDOM"
fi
AGENT_ID="agent_smoke_${RUN_ID:0:8}"
TASK_REF="smoke-${RUN_ID}"

FAILS=0
DISPATCH_ID=""

call() {
  local label="$1" method_q="$2" body="$3"
  local url="${BASE}?action=${method_q}"
  local out status
  out="$(curl -sS -o /tmp/smoke_body.$$ -w '%{http_code}' -X POST "$url" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'content-type: application/json' \
    --data "$body")" || { echo "FAIL $label: curl error"; FAILS=$((FAILS+1)); return 1; }
  status="$out"
  local payload; payload="$(cat /tmp/smoke_body.$$)"; rm -f /tmp/smoke_body.$$
  if [[ "$status" =~ ^2 ]]; then
    echo "PASS $label ($status)"
    printf '%s\n' "$payload"
    return 0
  fi
  echo "FAIL $label ($status): $payload" >&2
  FAILS=$((FAILS+1))
  return 1
}

# 1. create
CREATE_BODY="{\"source\":\"manual\",\"target_agent_id\":\"$AGENT_ID\",\"task_ref\":\"$TASK_REF\",\"payload\":{\"smoke_run_id\":\"$RUN_ID\"}}"
if RESP="$(call dispatch_create 'reliability_dispatches&method=upsert' "$CREATE_BODY")"; then
  DISPATCH_ID="$(printf '%s' "$RESP" | sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p' | head -n1)"
fi
if [[ -z "$DISPATCH_ID" ]]; then
  echo "FAIL dispatch_create: no dispatch_id in response" >&2
  exit 1
fi
echo "  dispatch_id=$DISPATCH_ID"

# 2. ack
call dispatch_ack 'reliability_dispatches&method=claim' \
  "{\"dispatch_id\":\"$DISPATCH_ID\",\"agent_id\":\"$AGENT_ID\",\"lease_seconds\":900}" >/dev/null

# 3. heartbeat
call dispatch_heartbeat 'reliability_heartbeats&method=publish' \
  "{\"dispatch_id\":\"$DISPATCH_ID\",\"agent_id\":\"$AGENT_ID\",\"state\":\"working\",\"current_task\":\"smoke\",\"next_action\":\"complete\",\"eta_minutes\":1}" >/dev/null

# 4. complete
call dispatch_complete 'reliability_heartbeats&method=publish' \
  "{\"dispatch_id\":\"$DISPATCH_ID\",\"agent_id\":\"$AGENT_ID\",\"state\":\"completed\"}" >/dev/null

# 5. fail path (separate dispatch so we don't fight the completed one)
FAIL_BODY="{\"source\":\"manual\",\"target_agent_id\":\"$AGENT_ID\",\"task_ref\":\"${TASK_REF}-fail\",\"payload\":{\"smoke_run_id\":\"$RUN_ID\"}}"
FAIL_DID=""
if RESP2="$(call dispatch_create_fail 'reliability_dispatches&method=upsert' "$FAIL_BODY")"; then
  FAIL_DID="$(printf '%s' "$RESP2" | sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p' | head -n1)"
fi
if [[ -n "$FAIL_DID" ]]; then
  call dispatch_ack_fail 'reliability_dispatches&method=claim' \
    "{\"dispatch_id\":\"$FAIL_DID\",\"agent_id\":\"$AGENT_ID\"}" >/dev/null
  call dispatch_fail 'reliability_dispatches&method=release' \
    "{\"dispatch_id\":\"$FAIL_DID\",\"agent_id\":\"$AGENT_ID\",\"status\":\"failed\"}" >/dev/null
fi

# 6. reclaim_stale (dry-run is non-destructive, safe to always run)
call dispatch_reclaim_stale 'reliability_reclaim_stale' \
  '{"limit":25,"dry_run":true}' >/dev/null

if (( FAILS == 0 )); then
  echo "OK reliability substrate smoke passed (run_id=$RUN_ID)"
  exit 0
fi
echo "$FAILS action(s) failed (run_id=$RUN_ID)" >&2
exit 1
