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

function compactText(value, max = 500) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

export function evaluateDogfoodRoom({
  scenario,
  steps = [],
  observations = [],
  requiredSignals = [],
} = {}) {
  if (!scenario) {
    return { ok: false, action: "dogfood_room", result: "blocker", reason: "missing_scenario" };
  }

  const failed = safeList(steps).filter((step) => ["failed", "blocker"].includes(normalize(step.status || step.result)));
  const missingSignals = safeList(requiredSignals).filter((signal) => !safeList(observations).some((observation) => normalize(observation.name || observation.signal) === normalize(signal) && normalize(observation.status || observation.result) === "passed"));

  if (failed.length > 0 || missingSignals.length > 0) {
    return {
      ok: false,
      action: "dogfood_room",
      result: "blocker",
      reason: failed.length ? "dogfood_step_failed" : "dogfood_signal_missing",
      scenario: compactText(scenario, 160),
      failed,
      missing_signals: missingSignals,
      packet: {
        worker: "forge",
        chip: `Dogfood repair: ${compactText(scenario, 80)}`,
        context: compactText([...failed.map((step) => step.name || step.detail), ...missingSignals.map((signal) => `missing ${signal}`)].join("; ")),
        expected_proof: "Make the smallest fix and rerun the dogfood scenario.",
        deadline: "next builder pulse",
        ack: "done/blocker",
      },
    };
  }

  return {
    ok: true,
    action: "dogfood_room",
    result: "passed",
    reason: "dogfood_green",
    scenario: compactText(scenario, 160),
    observations: safeList(observations),
  };
}

export async function readDogfoodRoomInput(filePath) {
  if (!filePath) return { ok: false, reason: "missing_input_path" };
  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readDogfoodRoomInput(getArg("input", process.env.PINBALLWAKE_DOGFOOD_ROOM_INPUT || ""))
    .then((input) => evaluateDogfoodRoom(input))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
