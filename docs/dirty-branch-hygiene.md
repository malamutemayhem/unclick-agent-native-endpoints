# Dirty-branch hygiene

Closes UnClick todo "Chip-firer dirty-branch hygiene: 3 PRs in a row leaking api/memory-admin.ts + server.ts" (promoted by efficiency sweep 2026-05-07).

## Why

Three PRs in a row touched `api/memory-admin.ts` and `server.ts` despite those files being outside the PRs' declared scope. This produces:

- **Review noise** — reviewers have to scan unrelated files to figure out if the change matters.
- **Unsafe merges** — drive-by edits to bootstrap or admin code can land without targeted review.
- **Throughput drag** — each false-positive review round adds latency.

This guard catches the leak before merge.

## How it works

`scripts/check-dirty-branch.mjs` runs `git diff --name-only` against the base branch and compares the changed files against a **leak-prone list** (`api/memory-admin.ts`, `server.ts` today; extend as needed). If a leak-prone file is touched AND the PR title/body doesn't reference it (either by exact file name or a known mnemonic like "memory-admin" or "bootstrap"), the script returns exit 1 with a printed warning.

The CI workflow `.github/workflows/dirty-branch-hygiene.yml` runs the same check on every PR open/edit/sync and surfaces results as a non-blocking warning annotation.

## Local pre-push check

```bash
node scripts/check-dirty-branch.mjs --base origin/main --pr-body-file ./pr-body.md
```

Or piped:

```bash
git diff --name-only origin/main | node scripts/check-dirty-branch.mjs --stdin --pr-body-file ./pr-body.md
```

Add as a pre-push hook in `.git/hooks/pre-push`:

```bash
#!/bin/sh
git diff --name-only origin/main | node scripts/check-dirty-branch.mjs --stdin --pr-body-file ./.git/PR_BODY 2>&1 || {
  echo "Dirty-branch hygiene warning — see above. To bypass, push with --no-verify."
  exit 0  # warn-only; change to `exit 1` to make it blocking locally
}
```

(The hook is opt-in per developer; not committed to the repo.)

## Extending the leak-prone list

When new leak patterns emerge, edit `LEAK_PRONE_FILES` at the top of `scripts/check-dirty-branch.mjs`:

```js
export const LEAK_PRONE_FILES = [
  "api/memory-admin.ts",
  "server.ts",
  "api/new-thing-that-keeps-leaking.ts",
];
```

For files with common mnemonics, add a regex variant to `SCOPE_MENTION_PATTERNS` in the same file.

## What's NOT in scope for this guard

- **Whole-directory leaks.** This guard only flags exact file paths. If a PR is touching every file in `api/` without justification, that's a code-review concern, not a hygiene-script concern.
- **Renames / moves.** A file being moved still counts as touched. If a deliberate rename is in flight, mention it in the PR body.
- **Auto-fixers (Prettier, ESLint --fix).** When an auto-fixer touches leak-prone files, the script still flags them. Easy fix: rerun the auto-fixer on `main`, commit, rebase your branch.

## Acceptance (ScopePack 10%)

- [x] `scripts/check-dirty-branch.mjs` exists, exits 0 on clean / 1 on leak / 2 on error.
- [x] `scripts/check-dirty-branch.test.mjs` covers: clean diff / leak-prone file mentioned / leak-prone file unmentioned / mnemonic match / multiple leaks / custom leak list.
- [x] `.github/workflows/dirty-branch-hygiene.yml` runs on PR events, non-blocking warning annotation.
- [x] Policy doc (this file) explains how to extend the list and use the local pre-push hook.

## Non-goals (deferred)

- Hardening to blocking gate — deferred until the warning-only version has been in flight for a week and the false-positive rate is known.
- Auto-revert of leak-prone files — too aggressive; humans should decide whether the change was intentional.
- Integration with the Build E PR template — the template already has a "Risk" checklist row that covers this verbally; this guard is the automated companion.

## Source

Drafted 2026-05-15 by `claude-cowork-coordinator-seat`. Files in `Z:\Other computers\My laptop\G\CV\_unclick-drafts\dirty-branch-hygiene\`.
