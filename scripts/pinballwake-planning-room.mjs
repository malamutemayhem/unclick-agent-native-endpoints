#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { chooseAutopilotRoute, diffBucketForLines, validateScopePack } from "./pinballwake-autopilot-triage.mjs";

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function compactText(value, max = 500) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function normalizePath(value) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function hasResearchArtifact(job = {}) {
  const research = job.research_report || job.researchReport || job.scoutpass || job.scoutPass || job.deepdive || job.deepDive;
  if (!research) {
    return false;
  }

  if (typeof research === "string") {
    return research.trim().length > 0;
  }

  return Object.keys(research).length > 0;
}

function routeNeedsResearch(route = {}) {
  return route.route === "research-then-planning" || route.route === "deep-research-then-planning";
}

function routeRiskRank(route = {}) {
  if (route.route === "deep-research-then-planning" || route.tier === "deep") return 3;
  if (route.route === "research-then-planning" && route.ack_required) return 2;
  if (route.route === "research-then-planning") return 1;
  return 0;
}

function defaultImplementationSteps(job = {}, route = {}) {
  const steps = safeList(job.implementation_steps || job.steps);
  if (steps.length) {
    return steps.map((step) => compactText(step, 240));
  }

  if (String(job.source || "").toLowerCase().includes("stuck-pr")) {
    return [
      "Refresh the current PR head and comments before editing.",
      "Identify the smallest file-scoped change that resolves the blocker.",
      "Apply only the owned-file change and run the listed proof.",
      "Update the PR body with owner, non-overlap, status, and exact proof.",
    ];
  }

  if (route.tier === "deep") {
    return [
      "Read the attached research result and preserve its stop conditions.",
      "Inspect only the owned files and nearest existing pattern.",
      "Make the smallest reversible implementation slice.",
      "Run the listed proof and stop on any blocker.",
    ];
  }

  return [
    "Inspect only the owned files and nearest existing pattern.",
    "Make the smallest scoped implementation slice.",
    "Run the listed proof and stop on any blocker.",
    "Report PASS/BLOCKER with exact proof output.",
  ];
}

function defaultRiskControls(route = {}) {
  const controls = [
    "Do not broaden scope beyond owned files.",
    "Stop if another active job owns the same file.",
    "Stop if the required proof command is missing or not allowlisted.",
    "No secrets, auth, billing, DNS/domains, migrations, raw keys, or destructive cleanup.",
  ];

  if (route.ack_required) {
    controls.push("Do not proceed past planning until the required ACK is visible.");
  }

  return controls;
}

function defaultStopConditions(route = {}) {
  const conditions = [
    "A required file is outside owned_files.",
    "A protected surface becomes necessary.",
    "Proof fails or cannot run.",
    "The job conflicts with another active branch or claim.",
  ];

  if (routeNeedsResearch(route)) {
    conditions.push("Research artifact is missing or contradicts the requested build.");
  }

  return conditions;
}

function defaultReviewerNeeds(route = {}) {
  return {
    qc_room_focus: ["Confirm the final PR matches this ScopePack and the proof is current."],
    gatekeeper_focus: route.ack_required
      ? ["Confirm protected-surface ACK and stop conditions are satisfied before lift."]
      : ["Confirm no protected surface or merge blocker was introduced."],
    forge_focus: ["Confirm implementation stayed inside owned_files and did not broaden architecture."],
  };
}

export function createPlanningRoomScopePack(job = {}, options = {}) {
  const computedRoute = chooseAutopilotRoute(job);
  const suppliedRoute = options.route || job.route || null;
  const route = suppliedRoute || computedRoute;

  if (
    suppliedRoute &&
    routeNeedsResearch(computedRoute) &&
    (!routeNeedsResearch(suppliedRoute) ||
      routeRiskRank(suppliedRoute) < routeRiskRank(computedRoute) ||
      (computedRoute.ack_required && !suppliedRoute.ack_required))
  ) {
    return {
      ok: false,
      action: "blocker",
      reason: "supplied_route_conflicts_with_job_risk",
      route: suppliedRoute,
      computed_route: computedRoute,
    };
  }

  if (route.route === "direct-to-coding") {
    return {
      ok: false,
      action: "skip",
      reason: "direct_to_coding_uses_inline_scopepack",
      route,
    };
  }

  if (route.route === "research-only") {
    return {
      ok: false,
      action: "blocker",
      reason: "research_only_cannot_plan",
      route,
    };
  }

  if (routeNeedsResearch(route) && !hasResearchArtifact(job)) {
    return {
      ok: false,
      action: "blocker",
      reason: route.route === "deep-research-then-planning" ? "deep_research_required_before_planning" : "research_required_before_planning",
      route,
    };
  }

  const ownedFiles = uniq(safeList(job.owned_files || job.ownedFiles || job.files).map(normalizePath));
  const lines = Number(job.estimated_lines ?? job.estimatedLines);
  const tests = safeList(job.tests || job.allowlist_tests || job.allowlistTests);
  const research = job.research_report || job.researchReport || job.scoutpass || job.scoutPass || job.deepdive || job.deepDive;

  const scopepack = {
    scopepack_id: compactText(job.scopepack_id || `scopepack:${compactText(job.id || job.job_id || "manual", 60)}:${options.now || Date.now()}`, 120),
    route: route.route,
    tier: route.tier,
    chip_title: compactText(job.title || job.chip || "Untitled Planning Room chip", 120),
    problem_statement: compactText(
      job.problem_statement || job.description || job.context || "Planning Room converted this job into an executable ScopePack.",
      800,
    ),
    owned_files: ownedFiles,
    non_overlap_statement: compactText(
      job.non_overlap_statement ||
        `This ScopePack owns only ${ownedFiles.length ? ownedFiles.join(", ") : "the listed owned files"} and must not overlap another active job.`,
      800,
    ),
    architecture_notes: compactText(
      job.architecture_notes ||
        (research?.recommended_architecture || research?.recommendation) ||
        "Use the existing local pattern; do not add new architecture unless the research artifact explicitly requires it.",
      800,
    ),
    implementation_steps: defaultImplementationSteps(job, route),
    test_proof_plan: {
      allowlist_tests: tests.map((test) => compactText(test, 240)),
      new_allowlist_entries_needed: false,
    },
    risk_controls: safeList(job.risk_controls || job.riskControls).length
      ? safeList(job.risk_controls || job.riskControls).map((risk) => compactText(risk, 240))
      : defaultRiskControls(route),
    stop_conditions: safeList(job.stop_conditions || job.stopConditions).length
      ? safeList(job.stop_conditions || job.stopConditions).map((condition) => compactText(condition, 240))
      : defaultStopConditions(route),
    expected_proof: compactText(job.expected_proof || job.expectedProof || "Proof Executor runs the listed tests and records PASS/BLOCKER.", 500),
    reviewer_needs: job.reviewer_needs || job.reviewerNeeds || defaultReviewerNeeds(route),
    planning_questions: safeList(job.planning_questions || job.planningQuestions).map((question) => compactText(question, 240)),
    research_summary: research ? compactText(research.summary || research.recommendation || research, 800) : "",
    diff_size_bucket: diffBucketForLines(lines),
    target_seat: compactText(job.target_seat || job.targetSeat || "codex", 80),
  };

  const validation = validateScopePack(scopepack);
  if (!validation.ok) {
    return {
      ok: false,
      action: "blocker",
      reason: validation.reason,
      field: validation.field,
      file: validation.file,
      route,
    };
  }

  return {
    ok: true,
    action: "plan",
    route,
    scopepack: validation.scopepack,
  };
}

async function main() {
  const inputPath = getArg("input");
  if (!inputPath) {
    console.error("Usage: node scripts/pinballwake-planning-room.mjs --input=job.json");
    process.exitCode = 1;
    return;
  }

  const job = JSON.parse(await readFile(inputPath, "utf8"));
  console.log(JSON.stringify(createPlanningRoomScopePack(job), null, 2));
}

if (process.argv[1] && process.argv[1].endsWith("pinballwake-planning-room.mjs")) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
