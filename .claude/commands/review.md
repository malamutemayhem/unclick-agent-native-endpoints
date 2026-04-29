---
name: review
description: Run a multi-agent review of the current branch. Fans out to qa-reviewer, security-reviewer, and doc-reviewer in parallel and returns a consolidated report.
disable-model-invocation: true
allowed-tools: Bash(git diff*), Bash(git log*), Bash(git status*)
---

# UnClick multi-agent review

Run a multi-agent review of the current branch.

## Step 1: gather context

Run these in parallel:
- `git status`
- `git log --oneline origin/main..HEAD`
- `git diff --stat origin/main...HEAD`

If the branch has no commits ahead of main, stop and report "No changes to review."

## Step 2: fan out

Invoke the three reviewer subagents IN PARALLEL using the Agent tool. Each gets the same context: the branch name, the commit list, and the diff stat from Step 1.

1. `qa-reviewer` - tests, acceptance criteria, contract integrity, AGENTS.md governance.
2. `security-reviewer` - credential leaks, RLS bypasses, service_role filters, unsafe queries.
3. `doc-reviewer` - drift between code and CLAUDE.md / AGENTS.md / docs/.

Send all three Agent tool calls in a single message so they run concurrently.

## Step 3: consolidate

Once all three return, write a single consolidated report with:

- `## Overall verdict` - the worst of the three verdicts (`BLOCK` > `PASS WITH NOTES` > `PASS`).
- `## QA review` - verdict + bulleted findings from qa-reviewer.
- `## Security review` - verdict + bulleted findings from security-reviewer.
- `## Doc review` - verdict + bulleted findings from doc-reviewer.
- `## Recommended next step` - one sentence: ship, fix and re-review, or escalate.

Do not edit files. Do not open a PR. This is a read-only review.
