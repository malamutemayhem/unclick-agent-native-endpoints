export type DogfoodStatus = "passing" | "failing" | "pending" | "blocked";

export interface DogfoodPassResult {
  id: string;
  name: string;
  status: DogfoodStatus;
  summary: string;
  evidence: string;
  checkedAt?: string;
  blockedReason?: string;
}

export interface DogfoodTrendPoint {
  date: string;
  passing: number;
  failing: number;
  blocked?: number;
  pending: number;
}

export const dogfoodReport = {
  generatedAt: "2026-05-01T00:50:00Z",
  lastRunAt: "2026-05-01T00:50:00Z",
  status: "blocked",
  source: "public seed receipt",
  headline: "We dogfood UnClick on UnClick.",
  target: "UnClick public and agent-facing product surfaces",
  nextAutomation: "Automated receipts will replace this seed as the dogfood loop expands.",
  results: [
    {
      id: "testpass",
      name: "TestPass",
      status: "passing",
      summary: "PR smoke checks are producing green receipts.",
      evidence: "Recent TestPass PR checks completed successfully on UnClick PRs.",
      checkedAt: "2026-05-01T00:50:00Z",
    },
    {
      id: "uxpass",
      name: "UXPass",
      status: "pending",
      summary: "Queued for recurring UX review.",
      evidence: "Public UX receipts will appear here once recurring checks begin.",
      checkedAt: "2026-05-01T00:50:00Z",
    },
    {
      id: "securitypass",
      name: "SecurityPass",
      status: "blocked",
      summary: "SecurityPass is blocked until the recurring runner proof is ready.",
      evidence: "SecurityPass remains scope-gated; the public dogfood receipt does not run security probes yet.",
      checkedAt: "2026-05-01T00:50:00Z",
      blockedReason: "SecurityPass is intentionally deny-all/scope-gated until a safe recurring runner proof lands.",
    },
    {
      id: "seopass",
      name: "SEOPass",
      status: "pending",
      summary: "Queued for recurring search and metadata review.",
      evidence: "Public SEO receipts will appear here once recurring checks begin.",
      checkedAt: "2026-05-01T00:50:00Z",
    },
    {
      id: "copypass",
      name: "CopyPass",
      status: "pending",
      summary: "Queued for recurring copy quality review.",
      evidence: "Public copy-quality receipts will appear here once recurring checks begin.",
      checkedAt: "2026-05-01T00:50:00Z",
    },
    {
      id: "legalpass",
      name: "LegalPass",
      status: "pending",
      summary: "Queued for recurring policy and claims review.",
      evidence: "Public legal-quality receipts will appear here once recurring checks begin.",
      checkedAt: "2026-05-01T00:50:00Z",
    },
  ] satisfies DogfoodPassResult[],
  trend: [
    { date: "2026-04-29", passing: 0, failing: 0, pending: 6 },
    { date: "2026-04-30", passing: 1, failing: 0, pending: 5 },
    { date: "2026-05-01", passing: 1, failing: 0, blocked: 1, pending: 4 },
  ] satisfies DogfoodTrendPoint[],
  lastActionableFailure: {
    title: "SecurityPass needs attention",
    detail: "SecurityPass is blocked until the recurring runner proof is ready. Blocked reason: SecurityPass is intentionally deny-all/scope-gated until a safe recurring runner proof lands.",
    owner: "Dogfood automation",
  },
};
