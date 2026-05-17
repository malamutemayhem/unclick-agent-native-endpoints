export type JobSyncStatus = "open" | "in_progress" | "done" | "dropped";

export interface JobGithubSyncInput {
  id: string;
  title: string;
  description?: string | null;
  status: JobSyncStatus;
  pipeline_evidence?: string[];
}

export interface JobGithubReference {
  kind: "pull_request" | "action_run" | "deployment";
  label: string;
  url?: string;
}

export interface JobGithubSyncSignal {
  label: string;
  detail: string;
  tone: "quiet" | "linked" | "done" | "alert";
  href?: string;
}

const GITHUB_PULL_URL_RE = /https:\/\/github\.com\/([^\s/)]+\/[^\s/)]+)\/pull\/(\d+)/gi;
const GITHUB_RUN_URL_RE = /https:\/\/github\.com\/([^\s/)]+\/[^\s/)]+)\/actions\/runs\/(\d+)/gi;
const VERCEL_URL_RE = /https:\/\/(?:vercel\.com|[^\s/)]+\.vercel\.app)[^\s)]*/gi;
const PR_NUMBER_RE = /\bPR\s*#(\d{1,7})\b/gi;
const FAILED_DEPLOY_RE = /\b(failed preview deployment|deployment failed|failed deployment|preview deployment failed|vercel failed)\b/i;
const PROOF_RESET_RE = /\b(reopened|re-opened|proof\s+reset|false\s+completion|partial\s+completion|proof_missing)\b/i;
const PROOF_MISSING_RE =
  /\b(no|missing|needs?|needed|waiting for|without|incomplete|stale)\s+(?:live\s+)?proof\b|\bproof\s+(?:missing|needed|incomplete|stale|not available)\b/i;

function uniqueByLabel(refs: JobGithubReference[]): JobGithubReference[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.kind}:${ref.label}:${ref.url ?? ""}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function jobSyncText(job: JobGithubSyncInput): string {
  return [job.id, job.title, job.description, ...(job.pipeline_evidence ?? [])]
    .filter(Boolean)
    .join("\n");
}

export function extractJobGithubReferences(job: JobGithubSyncInput): JobGithubReference[] {
  const text = jobSyncText(job);
  const refs: JobGithubReference[] = [];

  for (const match of text.matchAll(GITHUB_PULL_URL_RE)) {
    refs.push({
      kind: "pull_request",
      label: `PR #${match[2]}`,
      url: match[0],
    });
  }

  for (const match of text.matchAll(GITHUB_RUN_URL_RE)) {
    refs.push({
      kind: "action_run",
      label: `Run ${match[2]}`,
      url: match[0],
    });
  }

  for (const match of text.matchAll(VERCEL_URL_RE)) {
    refs.push({
      kind: "deployment",
      label: "Deploy",
      url: match[0],
    });
  }

  const hasPullUrl = refs.some((ref) => ref.kind === "pull_request");
  if (!hasPullUrl) {
    for (const match of text.matchAll(PR_NUMBER_RE)) {
      refs.push({
        kind: "pull_request",
        label: `PR #${match[1]}`,
      });
    }
  }

  return uniqueByLabel(refs);
}

export function jobHasDeploymentFailure(job: JobGithubSyncInput): boolean {
  return FAILED_DEPLOY_RE.test(jobSyncText(job));
}

export function jobHasProofReset(job: JobGithubSyncInput): boolean {
  const evidence = job.pipeline_evidence ?? [];
  const hasCurrentProgressEvidence = evidence.some((item) => /\b(build|proof|review|ship)\b/i.test(item));
  const hasResetEvidence = evidence.some((item) => PROOF_RESET_RE.test(item) || PROOF_MISSING_RE.test(item));
  if (hasCurrentProgressEvidence && !hasResetEvidence) return false;
  if (hasResetEvidence) return true;

  const text = jobSyncText(job);
  return PROOF_RESET_RE.test(text) || PROOF_MISSING_RE.test(text);
}

export function buildJobGithubSyncSignal(job: JobGithubSyncInput): JobGithubSyncSignal {
  const refs = extractJobGithubReferences(job);
  const firstPr = refs.find((ref) => ref.kind === "pull_request");
  const firstRun = refs.find((ref) => ref.kind === "action_run");
  const firstDeploy = refs.find((ref) => ref.kind === "deployment");
  const firstLink = firstPr ?? firstRun ?? firstDeploy;

  if (jobHasDeploymentFailure(job)) {
    return {
      label: "Deploy issue",
      detail: "A linked deployment needs attention.",
      tone: "alert",
      href: firstLink?.url,
    };
  }

  if (jobHasProofReset(job)) {
    return {
      label: "Proof reset",
      detail: "This job was reopened or blocked because proof is stale or missing.",
      tone: "alert",
    };
  }

  if (job.status === "done") {
    if (firstLink) {
      return {
        label: "Proof saved",
        detail: `${firstLink.label} is linked to this completed job.`,
        tone: "done",
        href: firstLink.url,
      };
    }
    return {
      label: "Proof missing",
      detail: "Completed job needs a PR, run, or deployment link.",
      tone: "alert",
    };
  }

  if (firstPr) {
    return {
      label: firstPr.label,
      detail: "GitHub PR is linked to this job.",
      tone: "linked",
      href: firstPr.url,
    };
  }

  if (firstRun) {
    return {
      label: "Run linked",
      detail: "GitHub run is linked to this job.",
      tone: "linked",
      href: firstRun.url,
    };
  }

  if (firstDeploy) {
    return {
      label: "Deploy linked",
      detail: "Deployment proof is linked to this job.",
      tone: "linked",
      href: firstDeploy.url,
    };
  }

  return {
    label: "Job first",
    detail: "Work starts here. Add a PR, run, or deployment link when code ships.",
    tone: "quiet",
  };
}
