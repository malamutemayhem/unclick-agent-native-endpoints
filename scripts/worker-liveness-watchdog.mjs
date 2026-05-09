#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export { evaluateWorkerLiveness } from "./lib/autopilot-liveness-helpers.mjs";
import { evaluateWorkerLiveness } from "./lib/autopilot-liveness-helpers.mjs";

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

async function main() {
  const inputPath = getArg("input");
  if (!inputPath) {
    console.error("Usage: node scripts/worker-liveness-watchdog.mjs --input=boardroom-snapshot.json");
    process.exitCode = 1;
    return;
  }

  const input = JSON.parse(await readFile(inputPath, "utf8"));
  console.log(JSON.stringify(evaluateWorkerLiveness(input), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
