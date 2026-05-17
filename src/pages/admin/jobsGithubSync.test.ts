import { describe, expect, it } from "vitest";
import {
  buildJobGithubSyncSignal,
  extractJobGithubReferences,
  jobHasDeploymentFailure,
  jobHasProofReset,
  type JobGithubSyncInput,
} from "./jobsGithubSync";

const baseJob: JobGithubSyncInput = {
  id: "4e9c7f73-5a67-4b50-a02a-9e2adcb8e3e0",
  title: "Jobs and GitHub sync",
  status: "open",
};

describe("Jobs and GitHub sync helpers", () => {
  it("keeps a job-first label when no GitHub proof is linked yet", () => {
    expect(buildJobGithubSyncSignal(baseJob)).toEqual({
      label: "Job first",
      detail: "Work starts here. Add a PR, run, or deployment link when code ships.",
      tone: "quiet",
    });
  });

  it("extracts a pull request URL as the linked proof", () => {
    const job = {
      ...baseJob,
      description: "Proof: https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/594",
    };

    expect(extractJobGithubReferences(job)).toEqual([
      {
        kind: "pull_request",
        label: "PR #594",
        url: "https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/594",
      },
    ]);
    expect(buildJobGithubSyncSignal(job)).toMatchObject({
      label: "PR #594",
      detail: "GitHub PR is linked to this job.",
      tone: "linked",
    });
  });

  it("uses PR number references when a URL is not available", () => {
    expect(buildJobGithubSyncSignal({ ...baseJob, title: "Finish PR #589 reconciliation" })).toMatchObject({
      label: "PR #589",
      tone: "linked",
    });
  });

  it("surfaces failed preview deployments as an action item", () => {
    const job = {
      ...baseJob,
      description: "Failed preview deployment on https://vercel.com/chris/unclick-agent-native-endpoints/abc123",
    };

    expect(jobHasDeploymentFailure(job)).toBe(true);
    expect(buildJobGithubSyncSignal(job)).toEqual({
      label: "Deploy issue",
      detail: "A linked deployment needs attention.",
      tone: "alert",
      href: "https://vercel.com/chris/unclick-agent-native-endpoints/abc123",
    });
  });

  it("expects completed jobs to keep proof attached", () => {
    expect(buildJobGithubSyncSignal({ ...baseJob, status: "done" })).toEqual({
      label: "Proof missing",
      detail: "Completed job needs a PR, run, or deployment link.",
      tone: "alert",
    });
    expect(
      buildJobGithubSyncSignal({
        ...baseJob,
        status: "done",
        pipeline_evidence: ["https://github.com/malamutemayhem/unclick-agent-native-endpoints/actions/runs/25590447727"],
      }),
    ).toMatchObject({
      label: "Proof saved",
      detail: "Run 25590447727 is linked to this completed job.",
      tone: "done",
    });
  });

  it("lets reopened or proof-reset state override stale GitHub links", () => {
    const reopenedJob = {
      ...baseJob,
      title: "REOPENED: Memory Library taxonomy snapshot proof",
      description: "Old PR #699 merged, but proof reset because the live Library still shows no snapshots.",
      pipeline_evidence: ["https://github.com/malamutemayhem/unclick-agent-native-endpoints/pull/699"],
    };

    expect(jobHasProofReset(reopenedJob)).toBe(true);
    expect(buildJobGithubSyncSignal(reopenedJob)).toEqual({
      label: "Proof reset",
      detail: "This job was reopened or blocked because proof is stale or missing.",
      tone: "alert",
    });
  });

  it("lets current pipeline proof clear old reopened wording", () => {
    const recoveredJob = {
      ...baseJob,
      title: "REOPENED: Memory Library taxonomy snapshot proof",
      description: "Old proof was reset because the live Library still shows no snapshots.",
      pipeline_evidence: ["build", "proof", "review"],
    };

    expect(jobHasProofReset(recoveredJob)).toBe(false);
    expect(buildJobGithubSyncSignal(recoveredJob)).toEqual({
      label: "Job first",
      detail: "Work starts here. Add a PR, run, or deployment link when code ships.",
      tone: "quiet",
    });
  });
});
