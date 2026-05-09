#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const FORCE_DEEP_FLAGS = new Set([
  "auth_or_keys",
  "billing",
  "brand_critical",
  "fsl_core",
  "legal_sensitive",
  "proof_allowlist",
  "schema_shared",
  "security_sensitive",
  "top_level_mcp",
  "xpass_safety",
]);

const ROUTES = new Set([
  "direct-to-coding",
  "planning-only",
  "research-then-planning",
  "deep-research-then-planning",
  "research-only",
  "defer-or-reject",
]);

const DIFF_BUCKETS = new Set(["under-50", "under-200", "under-500", "over-500"]);

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function bool(value) {
  return value === true || value === "true";
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

function safeList(values) {
  return Array.isArray(values) ? values : [];
}

function parseTags(job = {}) {
  const text = [
    job.title,
    job.description,
    job.problem_statement,
    job.context,
    ...(safeList(job.tags).map((tag) => `#${String(tag).replace(/^#/, "")}`)),
  ]
    .join(" ")
    .toLowerCase();

  return {
    skipResearch: text.includes("#skip-research") || text.includes("#urgent"),
    skipPlanning: text.includes("#skip-planning"),
    researchOnly: text.includes("#research-only"),
    forceDirection: text.includes("#direction"),
    forceLegal: text.includes("#legal"),
    forceSecurity: text.includes("#security"),
  };
}

function jobText(job = {}) {
  return [
    job.title,
    job.description,
    job.problem_statement,
    job.context,
    ...(safeList(job.tags).map((tag) => `#${String(tag).replace(/^#/, "")}`)),
  ]
    .join(" ")
    .toLowerCase();
}

function jobPaths(job = {}) {
  return safeList(job.files || job.owned_files || job.ownedFiles).map((file) => normalizePath(file).toLowerCase());
}

function hasSegment(path, pattern) {
  return path.split("/").some((segment) => pattern.test(segment));
}

function hasAnyTerm(text, terms) {
  return terms.some((term) => new RegExp(`\\b${term}\\b`, "i").test(text));
}

function inferProtectedSurfaceReasons(job = {}) {
  const paths = jobPaths(job);
  const text = jobText(job);
  const reasons = new Set();

  for (const path of paths) {
    const pathTerms = path.replace(/[\/_.-]+/g, " ");

    if (
      hasSegment(path, /^(auth|authentication|oauth|session|sessions|login|password|passkey|jwt)$/) ||
      hasSegment(path, /^(key|keys|keychain|credential|credentials|token|tokens|secret|secrets)$/) ||
      hasAnyTerm(pathTerms, [
        "auth",
        "authentication",
        "oauth",
        "jwt",
        "passkey",
        "passkeys",
        "credential",
        "credentials",
        "token",
        "tokens",
        "secret",
        "secrets",
        "keychain",
        "api key",
        "api keys",
      ])
    ) {
      reasons.add("auth_or_keys");
      reasons.add("security_sensitive");
    }

    if (
      hasSegment(path, /^(billing|payment|payments|stripe|checkout|invoice|invoices|subscription|subscriptions)$/) ||
      hasAnyTerm(pathTerms, ["billing", "payment", "payments", "stripe", "checkout", "invoice", "invoices", "subscription", "subscriptions"])
    ) {
      reasons.add("billing");
    }

    if (
      hasSegment(path, /^(migration|migrations|schema|schemas|prisma|drizzle|supabase)$/) ||
      /\b(fishbowl|room_jobs|ledger)\b.*\b(schema|migration)\b/.test(path) ||
      hasAnyTerm(pathTerms, ["migration", "migrations", "schema", "schemas", "supabase", "ledger", "room jobs"])
    ) {
      reasons.add("schema_shared");
    }

    if (
      path.includes("pinballwake-proof-executor") ||
      path.includes("proof-allowlist") ||
      path.includes("allowlist") ||
      /\bproof\b.*\ballowlist\b/.test(path)
    ) {
      reasons.add("proof_allowlist");
    }

    if (path.includes("xpass") || path.includes("testpass") || /\b(pass|proof|safety)\b.*\b(policy|guard)\b/.test(path)) {
      reasons.add("xpass_safety");
    }

    if (
      hasSegment(path, /^(mcp|mcp-server|servers)$/) ||
      path === "mcp.json" ||
      path === "server.js" ||
      path === "server.ts" ||
      path.endsWith("/mcp.json") ||
      path.includes("native-endpoints")
    ) {
      reasons.add("top_level_mcp");
    }

    if (hasSegment(path, /^(license|legal|terms|privacy|dpa|subprocessors)$/) || /\b(fsl|license|terms|privacy)\b/.test(path)) {
      reasons.add("legal_sensitive");
    }

    if (
      hasSegment(path, /^(security|redaction|redactions|sanitize|sanitizes|sanitized|sanitization|sanitisation|sanitise|csrf|csp|waf)$/) ||
      hasAnyTerm(pathTerms, [
        "security",
        "redaction",
        "redactions",
        "sanitize",
        "sanitizes",
        "sanitized",
        "sanitization",
        "sanitisation",
        "sanitise",
        "csrf",
        "csp",
        "waf",
      ])
    ) {
      reasons.add("security_sensitive");
    }
  }

  if (
    hasAnyTerm(text, [
      "auth",
      "authentication",
      "oauth",
      "jwt",
      "credential",
      "credentials",
      "secret",
      "secrets",
      "token",
      "tokens",
      "raw key",
      "raw keys",
      "api key",
      "api keys",
      "keychain",
      "password",
      "passwords",
      "passkey",
      "passkeys",
    ])
  ) {
    reasons.add("auth_or_keys");
    reasons.add("security_sensitive");
  }

  if (hasAnyTerm(text, ["billing", "stripe", "payment", "payments", "checkout", "invoice", "invoices", "subscription", "subscriptions"])) {
    reasons.add("billing");
  }

  if (hasAnyTerm(text, ["migration", "migrations", "schema", "schemas", "supabase", "ledger", "room jobs", "room_jobs"])) {
    reasons.add("schema_shared");
  }

  if (hasAnyTerm(text, ["proof allowlist", "proof allowlists", "allowlist", "allowlists", "proof executor", "proof command", "proof commands"])) {
    reasons.add("proof_allowlist");
  }

  if (hasAnyTerm(text, ["xpass", "testpass", "pass safety", "proof safety", "safety policy", "safety guard"])) {
    reasons.add("xpass_safety");
  }

  if (hasAnyTerm(text, ["fsl", "legal", "privacy", "license", "licenses", "terms", "dpa", "subprocessor", "subprocessors"])) {
    reasons.add("legal_sensitive");
  }

  if (hasAnyTerm(text, ["security", "redaction", "redactions", "sanitize", "sanitization", "sanitisation", "csrf", "csp", "waf"])) {
    reasons.add("security_sensitive");
  }

  if (hasAnyTerm(text, ["top-level mcp", "top level mcp", "mcp server", "mcp servers", "server registration"])) {
    reasons.add("top_level_mcp");
  }

  return [...reasons];
}

function estimateScope(job = {}) {
  if (Number.isFinite(job.scope)) {
    return clampAxis(job.scope);
  }

  const lines = Number(job.estimated_lines ?? job.estimatedLines);
  const fileCount = safeList(job.files || job.owned_files || job.ownedFiles).length;

  if (!Number.isFinite(lines) && fileCount === 0) {
    return 2;
  }

  if ((Number.isFinite(lines) && lines < 50) && fileCount <= 3) {
    return 0;
  }

  if ((Number.isFinite(lines) && lines <= 500) || (fileCount > 0 && fileCount <= 10)) {
    return 1;
  }

  return 2;
}

function estimateSurface(job = {}) {
  if (Number.isFinite(job.surface)) {
    return clampAxis(job.surface);
  }

  if (
    bool(job.cross_room) ||
    bool(job.crossRoom) ||
    bool(job.core_infra) ||
    bool(job.coreInfra) ||
    bool(job.fsl_core) ||
    bool(job.fslCore) ||
    bool(job.schema_shared) ||
    bool(job.schemaShared) ||
    bool(job.proof_allowlist) ||
    bool(job.proofAllowlist) ||
    bool(job.xpass_safety) ||
    bool(job.xpassSafety) ||
    bool(job.top_level_mcp) ||
    bool(job.topLevelMcp)
  ) {
    return 2;
  }

  const fileCount = safeList(job.files || job.owned_files || job.ownedFiles).length;
  if (bool(job.shared_surface) || bool(job.sharedSurface) || fileCount > 3) {
    return 1;
  }

  return 0;
}

function estimateReversibility(job = {}) {
  if (Number.isFinite(job.reversibility)) {
    return clampAxis(job.reversibility);
  }

  if (bool(job.data_loss) || bool(job.dataLoss) || bool(job.external_side_effects) || bool(job.externalSideEffects)) {
    return 2;
  }

  if (bool(job.migration) || bool(job.requires_migration) || bool(job.requiresMigration)) {
    return 1;
  }

  return 0;
}

function estimateNovelty(job = {}) {
  if (Number.isFinite(job.novelty)) {
    return clampAxis(job.novelty);
  }

  if (bool(job.no_prior_art) || bool(job.noPriorArt)) {
    return 2;
  }

  if (bool(job.third_party) || bool(job.thirdParty) || bool(job.new_pattern) || bool(job.newPattern)) {
    return 1;
  }

  return 0;
}

function estimateStakes(job = {}) {
  if (Number.isFinite(job.stakes)) {
    return clampAxis(job.stakes);
  }

  if (
    bool(job.billing) ||
    bool(job.security_sensitive) ||
    bool(job.securitySensitive) ||
    bool(job.legal_sensitive) ||
    bool(job.legalSensitive) ||
    bool(job.brand_critical) ||
    bool(job.brandCritical) ||
    bool(job.fsl_core) ||
    bool(job.fslCore) ||
    bool(job.auth_or_keys) ||
    bool(job.authOrKeys)
  ) {
    return 2;
  }

  if (bool(job.user_facing) || bool(job.userFacing)) {
    return 1;
  }

  return 0;
}

function clampAxis(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.min(2, Math.trunc(number)));
}

function forcedDeepReasons(job = {}, tags = parseTags(job)) {
  const reasons = new Set(inferProtectedSurfaceReasons(job));
  const aliases = {
    auth_or_keys: [job.auth_or_keys, job.authOrKeys],
    billing: [job.billing],
    brand_critical: [job.brand_critical, job.brandCritical],
    fsl_core: [job.fsl_core, job.fslCore],
    legal_sensitive: [job.legal_sensitive, job.legalSensitive, tags.forceLegal],
    proof_allowlist: [job.proof_allowlist, job.proofAllowlist],
    schema_shared: [job.schema_shared, job.schemaShared],
    security_sensitive: [job.security_sensitive, job.securitySensitive, tags.forceSecurity],
    top_level_mcp: [job.top_level_mcp, job.topLevelMcp],
    xpass_safety: [job.xpass_safety, job.xpassSafety],
  };

  for (const flag of FORCE_DEEP_FLAGS) {
    if ((aliases[flag] || []).some(bool)) {
      reasons.add(flag);
    }
  }

  if (tags.forceDirection) {
    reasons.add("direction");
  }

  return [...reasons];
}

export function scoreAutopilotJob(job = {}) {
  const axes = {
    scope: estimateScope(job),
    surface: estimateSurface(job),
    reversibility: estimateReversibility(job),
    novelty: estimateNovelty(job),
    stakes: estimateStakes(job),
  };

  return {
    axes,
    total: Object.values(axes).reduce((sum, value) => sum + value, 0),
    forced_deep_reasons: forcedDeepReasons(job),
  };
}

function routeResult({ route, tier = "inline", score, reason, ackRequired = false, suggestedAction = "build" }) {
  if (!ROUTES.has(route)) {
    throw new Error(`Unsupported autopilot route: ${route}`);
  }

  return {
    ok: true,
    route,
    tier,
    ack_required: ackRequired,
    suggested_action: suggestedAction,
    reason: compactText(reason, 240),
    score,
  };
}

export function chooseAutopilotRoute(job = {}) {
  const tags = parseTags(job);
  const score = scoreAutopilotJob(job);
  const source = String(job.source || "").toLowerCase();

  if (tags.researchOnly) {
    return routeResult({
      route: "research-only",
      tier: score.total >= 7 ? "deep" : "standard",
      score,
      ackRequired: score.total >= 7,
      reason: "user_requested_research_only",
      suggestedAction: "research",
    });
  }

  if (score.forced_deep_reasons.length > 0) {
    return routeResult({
      route: "deep-research-then-planning",
      tier: "deep",
      score,
      ackRequired: true,
      reason: `forced_deep:${score.forced_deep_reasons.join(",")}`,
      suggestedAction: "deep_research",
    });
  }

  if (source === "stuck-pr" || source === "queuepush-stuck-pr") {
    return routeResult({
      route: tags.skipPlanning ? "direct-to-coding" : "planning-only",
      tier: tags.skipPlanning ? "inline" : "standard",
      score,
      reason: tags.skipPlanning ? "stuck_pr_skip_planning_tag" : "stuck_pr_skip_research_plan_from_existing_diff",
    });
  }

  if (tags.skipResearch || tags.skipPlanning) {
    return routeResult({
      route: tags.skipPlanning ? "direct-to-coding" : "planning-only",
      tier: tags.skipPlanning ? "inline" : "standard",
      score,
      reason: tags.skipPlanning ? "user_skip_planning" : "user_skip_research_or_urgent",
    });
  }

  if (score.axes.novelty === 1 && score.axes.stakes <= 1) {
    return routeResult({
      route: "research-then-planning",
      tier: "scout",
      score,
      ackRequired: false,
      reason: "scoutpass_for_new_pattern_or_third_party",
      suggestedAction: "scout_research",
    });
  }

  const allAxesUnderTwo = Object.values(score.axes).every((value) => value <= 1);
  if (score.total <= 3 && allAxesUnderTwo) {
    return routeResult({
      route: "direct-to-coding",
      tier: "inline",
      score,
      reason: "small_low_risk_chip",
    });
  }

  if (score.total >= 9 || score.axes.reversibility === 2 || score.axes.stakes === 2) {
    return routeResult({
      route: "deep-research-then-planning",
      tier: "deep",
      score,
      ackRequired: true,
      reason: "high_score_or_high_stakes",
      suggestedAction: "deep_research",
    });
  }

  if (score.total >= 7) {
    return routeResult({
      route: "research-then-planning",
      tier: "standard",
      score,
      ackRequired: true,
      reason: "meaningful_uncertainty",
      suggestedAction: "research",
    });
  }

  if (score.total >= 4 && score.total <= 6 && score.axes.novelty >= 1) {
    return routeResult({
      route: "research-then-planning",
      tier: "standard",
      score,
      ackRequired: true,
      reason: "novel_medium_chip",
      suggestedAction: score.axes.novelty === 2 && score.axes.scope <= 1 ? "tiny_proof_spike" : "research",
    });
  }

  if (score.total >= 4 && score.total <= 6 && score.axes.surface >= 1) {
    return routeResult({
      route: "planning-only",
      tier: "standard",
      score,
      reason: "shared_surface_needs_scopepack",
    });
  }

  return routeResult({
    route: "planning-only",
    tier: "standard",
    score,
    reason: "default_medium_chip",
  });
}

export function diffBucketForLines(lines) {
  const number = Number(lines);
  if (!Number.isFinite(number)) {
    return "over-500";
  }

  if (number < 50) {
    return "under-50";
  }

  if (number < 200) {
    return "under-200";
  }

  if (number <= 500) {
    return "under-500";
  }

  return "over-500";
}

export function createInlineScopePack(job = {}, route = chooseAutopilotRoute(job)) {
  if (route.route !== "direct-to-coding") {
    return {
      ok: false,
      reason: "inline_scope_requires_direct_to_coding_route",
      route: route.route,
    };
  }

  const files = uniq(safeList(job.files || job.owned_files || job.ownedFiles).map(normalizePath));
  const lines = Number(job.estimated_lines ?? job.estimatedLines);

  const scopepack = {
    scopepack_id: job.scopepack_id || `inline:${compactText(job.source || "manual", 40)}:${Date.now()}`,
    route: route.route,
    tier: "inline",
    chip_title: compactText(job.title || job.chip || "Untitled Autopilot chip", 120),
    problem_statement: compactText(
      job.problem_statement || job.description || job.context || "Small low-risk chip routed directly to Coding Room.",
      800,
    ),
    owned_files: files,
    non_overlap_statement: compactText(
      job.non_overlap_statement ||
        "InlineScope owns only the listed files and must not touch shared infra, auth, billing, migrations, secrets, or another worker branch.",
      800,
    ),
    architecture_notes: compactText(job.architecture_notes || "Use the existing local pattern; no new architecture surface.", 800),
    implementation_steps: safeList(job.implementation_steps || job.steps).length
      ? safeList(job.implementation_steps || job.steps).map((step) => compactText(step, 240))
      : [
          "Inspect the owned files and nearest existing pattern.",
          "Make the smallest scoped change.",
          "Run the listed proof and stop on any blocker.",
        ],
    test_proof_plan: {
      allowlist_tests: safeList(job.tests || job.allowlist_tests || job.allowlistTests).map((test) => compactText(test, 240)),
      new_allowlist_entries_needed: false,
    },
    risk_controls: safeList(job.risk_controls || job.riskControls).length
      ? safeList(job.risk_controls || job.riskControls).map((risk) => compactText(risk, 240))
      : ["Do not broaden scope beyond owned files.", "Stop if proof command is missing from allowlist."],
    stop_conditions: safeList(job.stop_conditions || job.stopConditions).length
      ? safeList(job.stop_conditions || job.stopConditions).map((condition) => compactText(condition, 240))
      : ["Halt and ACK blocker if another active chip owns the same file.", "Halt if a migration/auth/secret path becomes necessary."],
    expected_proof: compactText(job.expected_proof || job.expectedProof || "Proof Executor runs the listed tests and records PASS/BLOCKER.", 500),
    reviewer_needs: job.reviewer_needs || job.reviewerNeeds || {
      qc_room_focus: ["Confirm PR body matches the tiny scope and proof is current."],
    },
    diff_size_bucket: diffBucketForLines(lines),
    target_seat: compactText(job.target_seat || job.targetSeat || "codex", 80),
  };

  return validateScopePack(scopepack);
}

function invalidPathReason(file) {
  if (!file) {
    return "empty_owned_file";
  }

  if (file.includes("..")) {
    return "owned_file_parent_traversal";
  }

  if (/^[a-z]:\//i.test(file) || file.startsWith("//")) {
    return "owned_file_must_be_repo_relative";
  }

  if (file.includes("*")) {
    return "owned_file_wildcard_not_allowed";
  }

  return "";
}

export function validateScopePack(scopepack = {}) {
  const requiredStrings = [
    "scopepack_id",
    "chip_title",
    "problem_statement",
    "non_overlap_statement",
    "architecture_notes",
    "expected_proof",
    "diff_size_bucket",
    "target_seat",
  ];

  for (const key of requiredStrings) {
    if (!String(scopepack[key] || "").trim()) {
      return { ok: false, reason: "missing_scopepack_field", field: key };
    }
  }

  if (!DIFF_BUCKETS.has(scopepack.diff_size_bucket)) {
    return { ok: false, reason: "invalid_diff_size_bucket", field: "diff_size_bucket" };
  }

  const ownedFiles = uniq(safeList(scopepack.owned_files).map(normalizePath));
  if (ownedFiles.length === 0) {
    return { ok: false, reason: "owned_files_required", field: "owned_files" };
  }

  for (const file of ownedFiles) {
    const reason = invalidPathReason(file);
    if (reason) {
      return { ok: false, reason, field: "owned_files", file };
    }
  }

  if (ownedFiles.length !== safeList(scopepack.owned_files).length) {
    return { ok: false, reason: "duplicate_owned_files", field: "owned_files" };
  }

  if (safeList(scopepack.implementation_steps).length === 0) {
    return { ok: false, reason: "implementation_steps_required", field: "implementation_steps" };
  }

  const allowlistTests = safeList(scopepack.test_proof_plan?.allowlist_tests);
  if (allowlistTests.length === 0) {
    return { ok: false, reason: "allowlist_tests_required", field: "test_proof_plan.allowlist_tests" };
  }

  if (safeList(scopepack.risk_controls).length === 0) {
    return { ok: false, reason: "risk_controls_required", field: "risk_controls" };
  }

  if (safeList(scopepack.stop_conditions).length === 0) {
    return { ok: false, reason: "stop_conditions_required", field: "stop_conditions" };
  }

  return {
    ok: true,
    scopepack: {
      ...scopepack,
      owned_files: ownedFiles,
      implementation_steps: scopepack.implementation_steps.map((step) => compactText(step, 240)),
      test_proof_plan: {
        ...scopepack.test_proof_plan,
        allowlist_tests: allowlistTests.map((test) => compactText(test, 240)),
      },
    },
  };
}

export function createAutopilotTriageResult(job = {}) {
  const route = chooseAutopilotRoute(job);
  const inlineScope = route.route === "direct-to-coding" ? createInlineScopePack(job, route) : null;

  return {
    ok: true,
    action: "triage",
    route,
    inline_scopepack: inlineScope?.ok ? inlineScope.scopepack : null,
    scopepack_blocker: inlineScope && !inlineScope.ok ? inlineScope.reason : null,
  };
}

async function main() {
  const inputPath = getArg("input");
  if (!inputPath) {
    console.error("Usage: node scripts/pinballwake-autopilot-triage.mjs --input=job.json");
    process.exitCode = 1;
    return;
  }

  const job = JSON.parse(await readFile(inputPath, "utf8"));
  console.log(JSON.stringify(createAutopilotTriageResult(job), null, 2));
}

if (process.argv[1] && process.argv[1].endsWith("pinballwake-autopilot-triage.mjs")) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
