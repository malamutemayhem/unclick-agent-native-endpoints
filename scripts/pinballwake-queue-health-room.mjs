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

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function classify(item = {}) {
  const text = `${item.reason || ""} ${item.status || ""} ${item.title || ""} ${item.blocker || ""}`.toLowerCase();
  if (text.includes("review") || text.includes("ack") || text.includes("pass")) return "review";
  if (text.includes("merge") || text.includes("draft") || text.includes("lift")) return "merge";
  if (text.includes("overlap") || text.includes("stomp")) return "overlap";
  if (text.includes("dirty") || text.includes("rebase")) return "rebase";
  if (text.includes("ci") || text.includes("test") || text.includes("vercel") || text.includes("publish")) return "proof";
  if (normalize(item.kind) === "job" || text.includes("build")) return "build";
  return "unknown";
}

function topBottleneck(counts = {}) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "none";
}

export function evaluateQueueHealthRoom({ items = [] } = {}) {
  const counts = {};
  for (const item of safeList(items)) {
    const lane = classify(item);
    counts[lane] = (counts[lane] || 0) + 1;
  }
  const bottleneck = topBottleneck(counts);

  return {
    ok: true,
    action: "queue_health_room",
    result: safeList(items).length ? "summary" : "idle",
    bottleneck,
    counts,
    recommendation:
      bottleneck === "review"
        ? "Chase PASS/BLOCKER ACKs or allow Merge Room fallback."
        : bottleneck === "merge"
          ? "Run Merge Room on full-PASS clean PRs."
          : bottleneck === "overlap"
            ? "Run Overlap Resolver Room."
            : bottleneck === "proof"
              ? "Route a Repair Room packet to the owner."
              : bottleneck === "build"
                ? "Route one Coding Room job to Forge."
                : "Queue is quiet or needs manual classification.",
  };
}

export async function readQueueHealthRoomInput(filePath) {
  if (!filePath) return { ok: false, reason: "missing_input_path" };
  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readQueueHealthRoomInput(getArg("input", process.env.PINBALLWAKE_QUEUE_HEALTH_ROOM_INPUT || ""))
    .then((input) => evaluateQueueHealthRoom(input))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
