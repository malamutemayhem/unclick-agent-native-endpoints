export type DogfoodStatus = "passing" | "failing" | "pending" | "blocked";

export interface DogfoodPassResult {
  id: string;
  name: string;
  status: DogfoodStatus;
  summary: string;
  evidence: string;
  checkedAt?: string;
  blockedReason?: string;
  runId?: string;
  targetUrl?: string;
  proof?: {
    kind: "testpass_run" | "uxpass_run" | "planned";
    runId?: string;
    targetUrl?: string;
  };
}

export interface DogfoodTrendPoint {
  date: string;
  passing: number;
  failing: number;
  blocked?: number;
  pending: number;
}

export const dogfoodReport = {
  generatedAt: "2026-05-01T17:16:13.158Z",
  lastRunAt: "2026-05-01T17:16:13.158Z",
  status: "blocked",
  source: "static fallback receipt",
  headline: "We dogfood UnClick on UnClick.",
  target: "UnClick public and agent-facing product surfaces",
  nextAutomation: "Nightly dogfood receipts refresh this board with live scheduled evidence.",
  results: [
    {
      id: "testpass",
      name: "TestPass",
      status: "passing",
      summary: "Scheduled TestPass completed with 17 checks and 0 failures.",
      evidence: "Run 2097cbe4-03da-4c32-9c10-3ddf9c4ffff5 checked https://unclick.world/api/mcp.",
      checkedAt: "2026-05-01T17:16:13.158Z",
      runId: "2097cbe4-03da-4c32-9c10-3ddf9c4ffff5",
      targetUrl: "https://unclick.world/api/mcp",
      proof: {
        kind: "testpass_run",
        runId: "2097cbe4-03da-4c32-9c10-3ddf9c4ffff5",
        targetUrl: "https://unclick.world/api/mcp",
      },
    },
    {
      id: "uxpass",
      name: "UXPass",
      status: "blocked",
      summary: "Scheduled UXPass could not run because DOGFOOD_UXPASS_TOKEN, UXPASS_TOKEN, or CRON_SECRET is missing.",
      evidence: "Set one workflow secret so the nightly dogfood workflow can create a fresh uxpass_runs row.",
      checkedAt: "2026-05-01T17:16:13.158Z",
      blockedReason: "Missing DOGFOOD_UXPASS_TOKEN, UXPASS_TOKEN, or CRON_SECRET.",
    },
    {
      id: "securitypass",
      name: "SecurityPass",
      status: "blocked",
      summary: "SecurityPass is blocked until the recurring runner proof is ready.",
      evidence: "SecurityPass remains scope-gated; the public dogfood receipt does not run security probes yet.",
      checkedAt: "2026-05-01T17:16:13.158Z",
      blockedReason: "SecurityPass is intentionally deny-all/scope-gated until a safe recurring runner proof lands.",
    },
    {
      id: "seopass",
      name: "SEOPass",
      status: "pending",
      summary: "Queued for recurring search and metadata review.",
      evidence: "SEOPass is still scaffold-only for public dogfood receipts.",
      checkedAt: "2026-05-01T17:16:13.158Z",
    },
    {
      id: "copypass",
      name: "CopyPass",
      status: "pending",
      summary: "Queued for recurring copy quality review.",
      evidence: "CopyPass recurring public receipts will land after the runner surface is available.",
      checkedAt: "2026-05-01T17:16:13.158Z",
    },
    {
      id: "legalpass",
      name: "LegalPass",
      status: "pending",
      summary: "Queued for recurring policy and claims review.",
      evidence: "LegalPass recurring public receipts will land after the runner surface is available.",
      checkedAt: "2026-05-01T17:16:13.158Z",
    },
    {
      id: "enterprisepass",
      name: "EnterprisePass",
      status: "pending",
      summary: "Seed enterprise-readiness report is published; automated evidence checks are not live yet.",
      evidence: "See /enterprise/latest.json for the readiness-report boundary and pending category map.",
      checkedAt: "2026-05-02T02:30:00Z",
      proof: { kind: "planned", targetUrl: "/enterprise/latest.json" },
    },
  ] satisfies DogfoodPassResult[],
  trend: [
    { date: "2026-05-01", passing: 1, failing: 0, blocked: 2, pending: 4 },
  ] satisfies DogfoodTrendPoint[],
  lastActionableFailure: {
    title: "UXPass needs attention",
    detail: "Scheduled UXPass could not run because DOGFOOD_UXPASS_TOKEN, UXPASS_TOKEN, or CRON_SECRET is missing. Blocked reason: Missing DOGFOOD_UXPASS_TOKEN, UXPASS_TOKEN, or CRON_SECRET.",
    owner: "Dogfood automation",
  },
};
