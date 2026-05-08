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

export const HEARTBEAT_PROTOCOL_DATE = "2026-05-07";
export const HEARTBEAT_PROTOCOL_REVISION = 2;

export function formatHeartbeatProtocolVersion(revision: number): string {
  return `${HEARTBEAT_PROTOCOL_DATE}.v${revision}`;
}

const HEARTBEAT_PROTOCOL: HeartbeatProtocol = {
  version: formatHeartbeatProtocolVersion(HEARTBEAT_PROTOCOL_REVISION),
  procedure: [
    "Call UnClick check_signals first. If unavailable, fall back to list_actionable_todos and read_messages. Cap to the most recent items UnClick returns.",
    "Compare against prior tether state from local automation state first, then heartbeat_last_state search_memory only if no transient state is available. The diff is the only thing worth surfacing.",
    'If no change, send nothing or exactly: "UnClick healthy." If UnClick surfaces action_needed, blocker, failed check, stale ACK, or approval-required items, send only the alert format.',
    "Keep healthy heartbeat state transient. Do not save recurring healthy or no-change heartbeats as Memory facts; use save_fact only for actionable diffs, tether errors, or explicit user-relevant state changes.",
    "Do not retry, escalate, route, build, merge, edit code, or perform actions outside this heartbeat procedure.",
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
