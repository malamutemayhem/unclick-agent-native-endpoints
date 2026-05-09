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

function normalizePath(value) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
}

function compactText(value, max = 500) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function prNumber(pr = {}) {
  const parsed = Number.parseInt(String(pr.number ?? pr.pr_number ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function prFiles(pr = {}) {
  return safeList(pr.files || pr.changed_files || pr.changedFiles)
    .map((file) => normalizePath(typeof file === "string" ? file : file.path))
    .filter(Boolean);
}

function textForPr(pr = {}) {
  return [
    pr.title,
    pr.body,
    pr.context,
    pr.proof_summary,
    safeList(pr.labels).join(" "),
  ].join(" ").toLowerCase();
}

function hasGreenChecks(pr = {}) {
  const checks = safeList(pr.statusCheckRollup || pr.checks);
  if (checks.length === 0) return false;
  return checks.every((check) => {
    const state = String(check.state || "").toUpperCase();
    const conclusion = String(check.conclusion || "").toUpperCase();
    const status = String(check.status || "").toUpperCase();
    if (state) return state === "SUCCESS";
    if (conclusion) return conclusion === "SUCCESS" || conclusion === "SKIPPED";
    return status === "COMPLETED";
  });
}

function securityWeight(pr = {}) {
  const text = textForPr(pr);
  const files = prFiles(pr).join(" ").toLowerCase();
  const haystack = `${text} ${files}`;
  const terms = ["security", "redaction", "secret", "token", "credential", "sanitize", "raw key"];
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 2 : 0), 0);
}

function proofWeight(pr = {}) {
  let score = 0;
  if (hasGreenChecks(pr)) score += 3;
  if (pr.proof_present || pr.proof === "PASS" || pr.proof_status === "PASS") score += 3;
  if (pr.targeted_proof_passed) score += 4;
  if (pr.hasHold || pr.hold || safeList(pr.blockers).length > 0) score -= 5;
  if (pr.isDraft || pr.draft) score -= 1;
  return score;
}

function explicitPriorityWeight(pr = {}) {
  const value = String(pr.priority || pr.owner_priority || "").toLowerCase();
  if (value === "primary" || value === "survivor" || value === "first") return 10;
  if (value === "secondary" || value === "rebase_after" || value === "after") return -3;
  if (value === "close" || value === "superseded") return -10;
  return 0;
}

export function scoreOverlapCandidate(pr = {}) {
  return {
    pr_number: prNumber(pr),
    score: explicitPriorityWeight(pr) + securityWeight(pr) + proofWeight(pr),
    security_weight: securityWeight(pr),
    proof_weight: proofWeight(pr),
    explicit_priority_weight: explicitPriorityWeight(pr),
    files: prFiles(pr),
  };
}

export function findOverlaps(prs = []) {
  const items = safeList(prs);
  const overlaps = [];

  for (let index = 0; index < items.length; index += 1) {
    for (let other = index + 1; other < items.length; other += 1) {
      const leftFiles = new Set(prFiles(items[index]));
      const shared = prFiles(items[other]).filter((file) => leftFiles.has(file));
      if (shared.length > 0) {
        overlaps.push({
          left: prNumber(items[index]),
          right: prNumber(items[other]),
          files: shared,
        });
      }
    }
  }

  return overlaps;
}

export function resolveOverlapRoom({ prs = [], preferredPr } = {}) {
  const items = safeList(prs);
  const overlaps = findOverlaps(items);

  if (items.length === 0) {
    return {
      ok: false,
      action: "overlap_resolver_room",
      result: "blocker",
      reason: "missing_prs",
    };
  }

  if (overlaps.length === 0) {
    return {
      ok: true,
      action: "overlap_resolver_room",
      result: "no_overlap",
      reason: "no_shared_files",
      decisions: items.map((pr) => ({
        pr_number: prNumber(pr),
        action: "can_continue",
      })),
      overlaps,
    };
  }

  const preferred = preferredPr ? Number(preferredPr) : null;
  const scored = items.map((pr) => {
    const score = scoreOverlapCandidate(pr);
    return {
      pr,
      ...score,
      score: score.score + (preferred && prNumber(pr) === preferred ? 20 : 0),
    };
  });
  scored.sort((a, b) => b.score - a.score || (a.pr_number ?? 999999) - (b.pr_number ?? 999999));

  const survivor = scored[0];
  const survivorFiles = new Set(survivor.files);
  const decisions = scored.map((candidate, index) => {
    if (index === 0) {
      return {
        pr_number: candidate.pr_number,
        action: "survivor_first",
        reason: "highest_overlap_score",
        score: candidate.score,
        files: candidate.files,
      };
    }

    const shared = candidate.files.filter((file) => survivorFiles.has(file));
    return {
      pr_number: candidate.pr_number,
      action: candidate.pr?.priority === "close" || candidate.pr?.owner_priority === "close" ? "close_or_supersede" : "hold_rebase_after_survivor",
      reason: "overlaps_survivor",
      score: candidate.score,
      shared_files: shared,
    };
  });

  return {
    ok: true,
    action: "overlap_resolver_room",
    result: "decision",
    reason: "overlap_resolved_to_survivor",
    survivor_pr: survivor.pr_number,
    overlaps,
    decisions,
    packet: {
      worker: "gatekeeper/xpass",
      chip: `Resolve overlap: PR #${survivor.pr_number} survivor-first`,
      context: compactText(
        `Shared files: ${overlaps.flatMap((overlap) => overlap.files).join(", ")}. Survivor PR #${survivor.pr_number} should land first; overlapping PRs hold/rebase/close after.`,
      ),
      expected_proof: "Recheck survivor PR for green checks, proof, and non-overlap after second lane holds.",
      deadline: "next review pulse",
      ack: "PASS/BLOCKER",
    },
  };
}

export async function readOverlapResolverInput(filePath) {
  if (!filePath) {
    return { ok: false, reason: "missing_input_path" };
  }

  return JSON.parse(await readFile(filePath, "utf8"));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  readOverlapResolverInput(getArg("input", process.env.PINBALLWAKE_OVERLAP_RESOLVER_INPUT || ""))
    .then((input) => resolveOverlapRoom(input))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
