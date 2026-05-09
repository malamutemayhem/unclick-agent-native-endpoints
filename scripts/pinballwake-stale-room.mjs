#!/usr/bin/env node

import { readFile } from "node:fs/promises";

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function parseMs(value) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function hoursBetween(now, then) {
  const current = parseMs(now);
  const past = parseMs(then);
  if (current === null || past === null) return null;
  return (current - past) / 36e5;
}

function compactText(value, max = 500) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function itemAge(item = {}, now) {
  return hoursBetween(now, item.updatedAt || item.updated_at || item.createdAt || item.created_at);
}

function itemKind(item = {}) {
  return item.kind || item.type || item.job_type || (item.number || item.pr_number ? "pr" : "item");
}

function staleThresholdHours(item = {}, defaults = {}) {
  const kind = itemKind(item);
  if (Number.isFinite(item.stale_after_hours)) return item.stale_after_hours;
  if (kind === "review" || item.job_type === "review") return defaults.reviewHours ?? 1;
  if (kind === "pr") return defaults.prHours ?? 6;
  if (kind === "job") return defaults.jobHours ?? 2;
  return defaults.defaultHours ?? 3;
}

export function evaluateStaleRoom({
  items = [],
  now = new Date().toISOString(),
  thresholds = {},
} = {}) {
  const stale = safeList(items)
    .map((item) => {
      const age_hours = itemAge(item, now);
      const threshold_hours = staleThresholdHours(item, thresholds);
      return {
        item,
        kind: itemKind(item),
        id: item.id || item.job_id || item.number || item.pr_number || item.title || "unknown",
        age_hours,
        threshold_hours,
        stale: age_hours !== null && age_hours >= threshold_hours,
      };
    })
    .filter((entry) => entry.stale);

  if (stale.length === 0) {
    return {
      ok: true,
      action: "stale_room",
      result: "clear",
      reason: "nothing_stale",
      checked: safeList(items).length,
    };
  }

  const packets = stale.map((entry) => {
    const worker = entry.item.worker || entry.item.requested_worker || (entry.kind === "review" ? "courier" : "master");
    return {
      worker,
      chip: `Refresh stale ${entry.kind} ${entry.id}`,
      context: compactText(entry.item.title || entry.item.chip || entry.item.context || `Stale for ${entry.age_hours.toFixed(1)}h`),
      expected_proof: "Reply with current status, blocker or next safe action, and next_checkin_at.",
      deadline: "next heartbeat",
      ack: "done/blocker",
      stale_age_hours: Number(entry.age_hours.toFixed(2)),
    };
  });

  return {
    ok: true,
    action: "stale_room",
    result: "stale_found",
    reason: "stale_items_need_refresh",
    stale_count: stale.length,
    stale: stale.map((entry) => ({
      kind: entry.kind,
      id: entry.id,
      age_hours: Number(entry.age_hours.toFixed(2)),
      threshold_hours: entry.threshold_hours,
    })),
    packets,
  };
}

export async function readStaleRoomInput(filePath) {
  if (!filePath) return { ok: false, reason: "missing_input_path" };
  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readStaleRoomInput(getArg("input", process.env.PINBALLWAKE_STALE_ROOM_INPUT || ""))
    .then((input) => evaluateStaleRoom(input))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
