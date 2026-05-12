import { createHash } from "node:crypto";

export type HeartbeatProtocol = {
  version: string;
  procedure: string[];
  alert_format: {
    heading: string;
    line_template: string;
    max_items: number;
    max_line_chars: number;
    style: string[];
    content_source: string;
  };
  throttle_rules: {
    idle_after: string;
    idle_cadence: string;
    active_cadence: string;
    idle_message: string;
    active_message: string;
    tether_error: string;
  };
  watch_state_key: string;
};

export const HEARTBEAT_PROTOCOL_DATE = "2026-05-12";
export const HEARTBEAT_PROTOCOL_REVISION = 10;

export function formatHeartbeatProtocolVersion(revision: number): string {
  return `${HEARTBEAT_PROTOCOL_DATE}.v${revision}`;
}

const HEARTBEAT_PROTOCOL: HeartbeatProtocol = {
  version: formatHeartbeatProtocolVersion(HEARTBEAT_PROTOCOL_REVISION),
  procedure: [
    'Treat this payload as the full heartbeat policy. Do not ask for a separate "Seats > Heartbeat" document or SKILL.md policy text.',
    "This heartbeat is explicitly authorized to write Orchestrator continuity receipts for the wake and the final PASS/BLOCKER result.",
    "Use stable session_id='unclick-heartbeat-seat' for every scheduled heartbeat run so Orchestrator can thread receipts across isolated scheduler sessions.",
    "Call UnClick check_signals first, then always do a compact job hunt before declaring health: read_orchestrator_context if available, list_actionable_todos, list_todos for open or in_progress work, recent dispatches, and recent Boardroom messages. Cap to the most recent items UnClick returns.",
    "Pinned v9 definition: active_jobs = COUNT(todos WHERE status='in_progress' AND owner_last_seen <= 24h). Orchestrator current_state_card.active_jobs uses the same query, so PASS/BLOCKER does not oscillate on identical state. Treat '0 active jobs' as PASS only when actionable_todos is also 0 (or every backlog item is explicitly held with a stated reason in the last 24h). If active_jobs is 0 while unheld actionable backlog exists, this is BLOCKER: queue hydration failure.",
    "Use PinballWake JobHunt Mirror as the fallback path for that failure: mirror compact backlog counts and source pointers into NudgeOnly first, then IgniteOnly only after verifier-backed receipt_bridge output requests a worker wake, then PushOnly only after IgniteOnly emits a verified public wake packet. Target the existing Job Worker as executor when it is registered; free API classifiers may only classify or nudge. The mirror may request a wake and PushOnly may emit a worker push envelope, but both must not create duplicate jobs, assign ownership, mark done, merge, close, or edit source state.",
    "After check_signals, call save_conversation_turn with session_id='unclick-heartbeat-seat', role='assistant', and content containing the safe alert lines plus a brief progress summary and proof id if available.",
    "When UnClick returns action_needed, blocker, stale ACK, missing proof, duplicate wake, unclear owner, or queue hydration failure items, call nudgeonly_receipt_bridge if available using compact public fields only: source_id, source_url, target, owner, painpoint_type, status, created_at, and ttl_minutes.",
    "Prefer deterministic painpoint labels from UnClick. Call nudgeonly_api only when no deterministic bucket exists, and only for the smallest safe source text needed to classify the painpoint.",
    "If nudgeonly_receipt_bridge returns receipt_request or escalation_request, save its bridge_id and receipt_line in the continuity receipt and alert line. If it returns quiet or advisory_only, do not notify.",
    "If a verified bridge request needs a dormant worker, call igniteonly_receipt_consumer if available using the bridge result and compact public fields only. When it returns wake_request or escalation_wake_request, call pushonly_wake_pusher if available using the public wake_packet. Save ignite_id, push_id, and wake_packet.receipt_line or push_packet.receipt_line.",
    "If save_conversation_turn is unavailable, use unclick_save_conversation_turn. If no UnClick connector exists but an UnClick API key is already available, POST the same turn to https://unclick.world/api/memory-admin?action=admin_conversation_turn_ingest. Never print the key. Do not POST to /admin/orchestrator because it is the read UI.",
    'For admin_conversation_turn_ingest, send Authorization: Bearer <redacted> and body { "session_id": "unclick-heartbeat-seat", "role": "assistant", "content": "<safe redacted heartbeat text>", "source_app": "scheduled-heartbeat", "client_session_id": "<local run id>" }.',
    "Compare against prior tether state from local automation state first, then heartbeat_last_state search_memory only if no transient state is available. The diff is the only thing worth surfacing.",
    'If no change, send nothing or exactly: "UnClick healthy." If UnClick surfaces action_needed, blocker, failed check, stale ACK, or approval-required items, send only the alert format.',
    "Keep healthy heartbeat state transient. Do not save recurring healthy or no-change heartbeats as Memory facts; use save_fact only for actionable diffs, tether errors, or explicit user-relevant state changes.",
    "If every UnClick write path, tool, and context path is missing, reply with a concise BLOCKER that names the missing capability and the next packaging fix.",
    "Do not build, merge, edit code, assign ownership, mark done, or perform mutation actions outside this heartbeat procedure. NudgeOnly may request a receipt or escalation only. IgniteOnly may request a worker wake only. PushOnly may emit a worker push envelope only. Trusted lanes must verify before action.",
  ],
  alert_format: {
    heading: "UnClick alert",
    line_template: "owner -- target -- status -- next safe action",
    max_items: 3,
    max_line_chars: 140,
    style: ["no prose", "no bullets", "no bold"],
    content_source: "UnClick",
  },
  throttle_rules: {
    idle_after: "24h without signals",
    idle_cadence: "daily 9am",
    active_cadence: "10 minutes",
    idle_message: "UnClick idle -- heartbeat throttled to daily digest.",
    active_message: "UnClick active again -- heartbeat back to 10-minute cadence.",
    tether_error: "fail quietly and save heartbeat_last_error with a short reason",
  },
  watch_state_key: "heartbeat_last_state",
};

export function heartbeatProtocolContentFingerprint(protocol = HEARTBEAT_PROTOCOL): string {
  const { version: _version, ...content } = protocol;
  return createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 16);
}

export function getHeartbeatProtocol(): HeartbeatProtocol {
  return JSON.parse(JSON.stringify(HEARTBEAT_PROTOCOL)) as HeartbeatProtocol;
}
