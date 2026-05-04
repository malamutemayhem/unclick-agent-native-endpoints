#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { chooseAutopilotRoute, scoreAutopilotJob } from "./pinballwake-autopilot-triage.mjs";

const DEPTHS = new Set(["scout", "standard", "deep"]);

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

function normalizeDepth(value, fallback = "standard") {
  const depth = String(value || fallback).toLowerCase();
  return DEPTHS.has(depth) ? depth : fallback;
}

function routeNeedsResearch(route = {}) {
  return route.route === "research-only" || route.route === "research-then-planning" || route.route === "deep-research-then-planning";
}

function defaultQuestionBank(depth) {
  const common = [
    "What exact problem is this solving for UnClick Autopilot?",
    "Does a free, open-source, or forkable version already exist?",
    "What are the practical feasibility risks in our current stack?",
    "What is the smallest useful implementation slice?",
    "What proof would make the recommendation trustworthy?",
    "What should make the builder stop and ask for help?",
  ];

  if (depth === "scout") {
    return [
      ...common,
      "Is this a known pattern we can copy safely?",
      "What is the 80/20 version that avoids over-researching?",
    ];
  }

  if (depth === "deep") {
    return [
      ...common,
      "What are the security, privacy, legal, or protected-surface failure modes?",
      "What are the best alternatives and why should we reject them?",
      "What attack paths or misuse cases could bypass the design?",
      "What exact ACK gate is required before planning or build?",
      "Which files or surfaces must remain out of scope?",
    ];
  }

  return [
    ...common,
    "What current practice from comparable agent systems is relevant?",
    "What implementation shape best preserves build quality?",
    "What should Planning Room convert into the ScopePack?",
  ];
}

function defaultEvidenceNeeds(depth) {
  if (depth === "scout") {
    return ["1-3 credible findings", "existing local repo patterns", "one recommended next step"];
  }

  if (depth === "deep") {
    return [
      "current primary-source or implementation evidence where available",
      "explicit risks and rejected alternatives",
      "safe stop conditions and ACK requirement",
      "recommended ScopePack constraints",
    ];
  }

  return ["current docs or comparable examples", "repo pattern check", "recommended plan constraints"];
}

export function createResearchRoomBrief(job = {}, options = {}) {
  const route = options.route || job.route || chooseAutopilotRoute(job);

  if (!routeNeedsResearch(route)) {
    return {
      ok: false,
      action: "skip",
      reason: "research_not_required_for_route",
      route,
    };
  }

  const score = route.score || scoreAutopilotJob(job);
  const depth = normalizeDepth(options.depth || job.depth || route.tier, route.route === "deep-research-then-planning" ? "deep" : "standard");
  const protectedReasons = safeList(score.forced_deep_reasons);

  const brief = {
    research_id: compactText(job.research_id || `research:${compactText(job.id || job.job_id || "manual", 60)}:${options.now || Date.now()}`, 120),
    depth,
    route: route.route,
    ack_required: Boolean(route.ack_required || depth === "deep"),
    title: compactText(job.title || job.chip || "Untitled Research Room job", 120),
    problem_statement: compactText(
      job.problem_statement || job.description || job.context || "Research Room should clarify whether and how this job should proceed.",
      1000,
    ),
    owned_files_hint: safeList(job.owned_files || job.ownedFiles || job.files).map((file) => compactText(file, 160)),
    protected_reasons: protectedReasons,
    question_bank: safeList(job.research_questions || job.researchQuestions).length
      ? safeList(job.research_questions || job.researchQuestions).map((question) => compactText(question, 240))
      : defaultQuestionBank(depth),
    evidence_needed: defaultEvidenceNeeds(depth),
    output_contract: {
      verdicts: ["proceed_to_planning", "needs_more_research", "reject_or_defer"],
      required_fields: [
        "summary",
        "recommendation",
        "risks",
        "alternatives_considered",
        "scopepack_constraints",
        "proof_recommendations",
        "stop_conditions",
      ],
    },
    safety: [
      "No repo edits from Research Room.",
      "No branch/PR creation from Research Room.",
      "No secrets, auth, billing, DNS/domains, migrations, raw keys, or destructive cleanup.",
      "Deep research outputs require ACK before Planning Room consumes them.",
    ],
  };

  return {
    ok: true,
    action: "research",
    route,
    brief,
  };
}

export function validateResearchRoomReport(report = {}) {
  const requiredStrings = ["summary", "recommendation"];
  for (const field of requiredStrings) {
    if (!String(report[field] || "").trim()) {
      return { ok: false, reason: "missing_report_field", field };
    }
  }

  const requiredLists = ["risks", "alternatives_considered", "scopepack_constraints", "proof_recommendations", "stop_conditions"];
  for (const field of requiredLists) {
    if (safeList(report[field]).length === 0) {
      return { ok: false, reason: "missing_report_list", field };
    }
  }

  const verdict = String(report.verdict || "").trim();
  if (!["proceed_to_planning", "needs_more_research", "reject_or_defer"].includes(verdict)) {
    return { ok: false, reason: "invalid_research_verdict", field: "verdict" };
  }

  if (report.depth === "deep" && report.ack_required !== true) {
    return { ok: false, reason: "deep_report_requires_ack", field: "ack_required" };
  }

  if (report.depth === "deep" && report.ack_complete !== true && report.ack_status !== "PASS" && report.ack !== "PASS") {
    return { ok: false, reason: "deep_report_ack_not_complete", field: "ack_complete" };
  }

  return {
    ok: true,
    report: {
      ...report,
      summary: compactText(report.summary, 1200),
      recommendation: compactText(report.recommendation, 1200),
      risks: safeList(report.risks).map((risk) => compactText(risk, 240)),
      alternatives_considered: safeList(report.alternatives_considered).map((alternative) => compactText(alternative, 240)),
      scopepack_constraints: safeList(report.scopepack_constraints).map((constraint) => compactText(constraint, 240)),
      proof_recommendations: safeList(report.proof_recommendations).map((proof) => compactText(proof, 240)),
      stop_conditions: safeList(report.stop_conditions).map((condition) => compactText(condition, 240)),
    },
  };
}

async function main() {
  const inputPath = getArg("input");
  if (!inputPath) {
    console.error("Usage: node scripts/pinballwake-research-room.mjs --input=job.json");
    process.exitCode = 1;
    return;
  }

  const payload = JSON.parse(await readFile(inputPath, "utf8"));
  const mode = getArg("mode", "brief");
  const result = mode === "validate-report" ? validateResearchRoomReport(payload) : createResearchRoomBrief(payload);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && process.argv[1].endsWith("pinballwake-research-room.mjs")) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
