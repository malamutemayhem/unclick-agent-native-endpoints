<!-- Review enforcement bundle — Build E. See docs/review-enforcement.md for the policy. -->

## Summary

<!-- 1-2 sentences. What does this PR change and why. -->

## Closes / refs

<!-- Link the UnClick todo(s) this PR resolves. Use any of:
     Closes: <todo-uuid>
     Refs: <todo-uuid>
     PR: #<number>
-->

## Risk

- [ ] Touches no protected paths (`.env*`, `vercel.json`, `.github/workflows/*`, `supabase/*`, `migrations/*`, lockfiles).
- [ ] No secrets in commits, PR body, or comments.
- [ ] No DNS / billing / production deploy / force-push.

## Review checklist

- [ ] **Reviewer PASS:** Code reviewed against latest HEAD SHA. Comment on the PR with `Reviewer PASS <SHA>`.
- [ ] **Safety PASS:** Protected-surface, dependency, and authority checks done. Comment with `Safety PASS <SHA>`.
- [ ] **Proof receipt:** PR description or comment links the run id, head SHA, and any related ScopePack comment id.

> Reviewer/Safety PASS comments are **required on the latest HEAD SHA** — bumping the branch invalidates prior PASS comments and requires re-review. (Rank-10 in the consolidated automation methods doc.)

## Test plan

<!-- The smallest meaningful check that verifies this PR. Paste the command and the result. -->

```
node --test scripts/<your-test>.test.mjs
```

## Notes for autopilot

<!-- Optional: hints for downstream automation. -->

- BuildBait step (if applicable):
- Parser tag (if applicable): `BUILDBAIT/STEP=<n>`
- Heartbeat tick id (if applicable):
