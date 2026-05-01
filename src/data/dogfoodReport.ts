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
  status: "pending",
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
    { date: "2026-04-29", passing: 0, failing: 0, pending: 5 },
    { date: "2026-04-30", passing: 1, failing: 0, pending: 4 },
    { date: "2026-05-01", passing: 1, failing: 0, pending: 4 },
  ] satisfies DogfoodTrendPoint[],
  lastActionableFailure: {
    title: "Canonical public check target needs confirmation",
    detail: "The next automated receipt should lock the exact public URL set that represents UnClick's production experience.",
    owner: "Dogfood automation follow-up",
  },
};
