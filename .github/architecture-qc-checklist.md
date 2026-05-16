# Architecture QC review checklist

Closes UnClick todo "Architecture QC: reuse and boundary PR checklist v1" (Child of `87fb888e`).

This is a **reviewer-facing** checklist. Authors don't need to tick every item; reviewers run through it during code review and call out concerns in line comments.

Paired with the PR template from Build E (`.github/PULL_REQUEST_TEMPLATE.md`). Reviewers can paste the relevant subset into their review comments.

---

## 1. Helper reuse

- [ ] Does this PR introduce a function/class that duplicates logic already in `api/lib/`, `src/lib/`, or `scripts/`? If yes, prefer importing the existing helper or refactoring it.
- [ ] Are crypto helpers (PBKDF2, AES-GCM, HMAC) imported from `api/lib/crypto-helpers.ts`? Inline implementations of these are not acceptable — they drift.
- [ ] Are date / time / timezone helpers imported from a single source (whichever the repo standardises on)?
- [ ] Are auth / session checks consolidated, not re-implemented per route?

## 2. Package-boundary imports

- [ ] Imports inside `api/` should not reach into `src/` private internals (and vice versa). Use the public surface only.
- [ ] No relative imports across package boundaries (e.g. `import x from "../../../src/lib/y"`). Use the package's exported name.
- [ ] Tests for `api/testpass.ts` should not import from `testpass/internals/*` — go through the public exports.
- [ ] If the PR adds an internal helper that two packages want, the helper belongs in a shared lib, not duplicated.

## 3. New abstraction discipline

- [ ] If this PR adds a new class / interface / type that wraps existing functionality, is the wrapping load-bearing? "I felt like a helper would be nice" is not a justification.
- [ ] Single-call-site abstractions are usually premature. Wait for the second caller before extracting.
- [ ] New types should be in the layer that owns them (DB types in db/, API types in api/, view types in src/components/), not in a top-level `types/` grab-bag.
- [ ] Is there a one-line comment at the abstraction point describing what changes would push you to remove it? If not, the abstraction may be vague.

## 4. Test placement and coverage

- [ ] Unit tests live next to the code they cover (`x.ts` + `x.test.ts` co-located), not in a far-away `__tests__/` directory.
- [ ] New public exports have at least one test exercising the happy path.
- [ ] Tests use the same import path consumers will use (avoids the "tests work but production breaks" anti-pattern).
- [ ] Mock factories live in the test file unless a second test file would benefit from them, in which case extract to a sibling `__mocks__/x.ts`.

## 5. Protected-surface awareness

- [ ] No changes to `.env*`, `vercel.json`, `.github/workflows/*`, `supabase/*`, `migrations/*`, lockfiles unless explicitly intended and called out in the PR description.
- [ ] No new dependencies without a one-line "why" in the PR description.
- [ ] No new `eval`, `child_process.exec` with concatenated user input, or `vm.runInThisContext`. These are pull-into-review-meeting flags.

## 6. Boundary-of-change

- [ ] The PR description names the scope. The diff stays within that scope.
- [ ] Drive-by refactors larger than 10 lines should be a separate PR.
- [ ] If unrelated files are dirty in the diff because of formatting auto-fix, call them out in the PR body so reviewers know not to read them as part of the change.

## 7. Naming

- [ ] No legacy / superseded names in new code (e.g., "Fishbowl", "Popcorn") unless explicitly bridging old systems. See `Architecture QC: Boardroom/Fishbowl compatibility map v1` (todo `87fb888e` child) for the canonical list.
- [ ] Public exports use clear, searchable names. Avoid generic `Helper`, `Util`, `Manager` unless the surface really is generic.

## 8. Failure / error surfaces

- [ ] New errors have stable `code` strings (or equivalent) so callers can branch without parsing messages.
- [ ] Async functions either propagate or surface errors meaningfully — silent `try { ... } catch {}` is reviewer-flag material unless commented.
- [ ] Sensitive values (tokens, keys, ciphertext) never appear in error messages thrown to clients.

---

## How to use this checklist in review

1. Open the PR.
2. In the Review tab, paste the headers you care about (often just §1, §2, §6) as a comment.
3. Tick the items that pass. For items that don't, leave inline comments on the offending lines.
4. If everything passes, the standard `Reviewer PASS <SHA>` comment is enough — no need to re-paste the checklist.

A short PR (≤50 LOC) usually only triggers §1, §6, §7. A larger PR likely touches more sections — pick the ones that apply.

## When to escalate to a parent ScopePack

If a single PR keeps tripping multiple checklist items, that's a signal the underlying ScopePack is too broad. Open a sibling todo titled `Architecture QC: <area> rework` and route the rework as its own work item rather than amending the original PR endlessly.

## Source

Drafted 2026-05-15 by `claude-cowork-coordinator-seat`. Pairs with:

- PR template from Build E (`feat/build-e-review-enforcement`).
- Crypto helper from shared-api-crypto-helper (`feat/shared-api-crypto-helper`).
- Future Arch-QC sibling PRs (Tools split, Boardroom/Fishbowl map, TestPass boundary cleanup) which this checklist will help review.
