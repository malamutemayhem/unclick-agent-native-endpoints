#!/usr/bin/env node
/**
 * Seed BackstagePass (Keychain) vault from a local plan file.
 *
 * Usage:
 *   node scripts/seed-vault-from-plan.mjs [plan-file.json]
 *
 * The plan file is a JSON document with this shape:
 *   {
 *     "api_key":     "uc_...",           // the owner's UnClick API key
 *     "api_base":    "https://unclick.world", // optional, defaults to production
 *     "credentials": [
 *       {
 *         "platform":    "github",        // must match platform_connectors.id
 *         "label":       "personal",      // optional, defaults to "default"
 *         "values":      { "api_key": "ghp_..." }
 *       },
 *       {
 *         "platform":    "google-workspace",
 *         "values": {
 *           "client_id":     "...apps.googleusercontent.com",
 *           "client_secret": "GOCSPX-...",
 *           "refresh_token": "..."
 *         }
 *       }
 *     ]
 *   }
 *
 * The script POSTs each entry to /api/credentials, which handles encryption
 * server-side (AES-256-GCM with a random per-credential salt).
 *
 * Never commit a real plan file. Name it *.local.json so .gitignore skips it.
 */

import { readFile } from "node:fs/promises";
import { argv, exit } from "node:process";

const DEFAULT_API_BASE = "https://unclick.world";

function usage(msg) {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error("Usage: node scripts/seed-vault-from-plan.mjs <plan-file.json>");
  exit(msg ? 1 : 0);
}

async function main() {
  const planPath = argv[2];
  if (!planPath) usage("missing plan file path");

  let plan;
  try {
    const raw = await readFile(planPath, "utf8");
    plan = JSON.parse(raw);
  } catch (err) {
    usage(`failed to read plan file: ${err.message}`);
  }

  const apiKey  = plan.api_key;
  const apiBase = (plan.api_base || DEFAULT_API_BASE).replace(/\/$/, "");
  const entries = Array.isArray(plan.credentials) ? plan.credentials : [];

  if (!apiKey || !/^uc_|^agt_/.test(apiKey)) {
    usage("plan.api_key must be a UnClick API key starting with uc_ or agt_");
  }
  if (entries.length === 0) usage("plan.credentials must be a non-empty array");

  console.log(`Seeding ${entries.length} credential entr${entries.length === 1 ? "y" : "ies"} into ${apiBase}\n`);

  let ok = 0, failed = 0;
  for (const entry of entries) {
    const { platform, values, label } = entry;
    if (!platform || !values || typeof values !== "object") {
      console.error(`  ✗ invalid entry: ${JSON.stringify(entry)}`);
      failed++;
      continue;
    }

    const body = {
      platform,
      credentials: label ? { ...values, __label: label } : values,
      api_key:     apiKey,
    };

    try {
      const res = await fetch(`${apiBase}/api/credentials`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      if (res.ok) {
        console.log(`  ✓ ${platform}${label ? ` [${label}]` : ""}`);
        ok++;
      } else {
        const text = await res.text().catch(() => "");
        console.error(`  ✗ ${platform}: ${res.status} ${text.slice(0, 160)}`);
        failed++;
      }
    } catch (err) {
      console.error(`  ✗ ${platform}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${ok} ok, ${failed} failed`);
  exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  exit(1);
});
