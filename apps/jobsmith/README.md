# Jobsmith v0: drafted code drop

Drafted 2026-05-15 under Chris's any-worker-hat greenlight while waiting on UnClick fleet seats to claim. Pairs with:

- UnClick todo `4bcb3169` (Jobsmith v0)
- ScopePack v1 comment `11329bb8`
- Builder hand-off doc at `../jobsmith-v0-builder-handoff.md` in the parent CV folder

## Files in this folder

```
jobsmith-v0/
├─ README.md (this file)
├─ docs/
│  └─ jobsmith-v0.md           # user-facing doc for the v0 release
└─ src/
   ├─ lib/
   │  ├─ ingestCvCorpus.ts     # read & normalise the CV folder
   │  ├─ ingestCvCorpus.test.ts
   │  ├─ voiceProfile.ts       # extract statistical voice signal
   │  ├─ voiceProfile.test.ts
   │  ├─ renderDraft.ts        # compose cover letter draft from JD + profile
   │  └─ renderDraft.test.ts
   └─ pages/
      └─ JobsmithDraft.tsx     # React page (paste JD → preview profile → draft)
```

## How to drop into the unclick repo

```bash
# from inside the unclick repo root:
mkdir -p apps/jobsmith/src/lib apps/jobsmith/src/pages apps/jobsmith/docs
cp -r path/to/this/folder/* apps/jobsmith/
```

Then wire `apps/jobsmith` into the workspace however the repo handles new app folders (likely a top-level `package.json` add, plus the package's own `package.json` + `tsconfig.json`; those aren't included in this draft because they depend on the existing workspace conventions).

## Test it

```bash
pnpm --filter jobsmith test
# or, if no workspace yet:
cd apps/jobsmith && npx vitest run
```

All three lib suites are designed to pass with zero external dependencies; they use tmp fixtures and in-memory Corpus objects.

## Builder TODO before opening a PR

1. Add `apps/jobsmith/package.json` matching the repo's TS/React conventions (vitest, react, react-dom, tsconfig extending the workspace root).
2. Add `apps/jobsmith/tsconfig.json` extending the repo root.
3. Register the page route. The UI uses inline styles only, so no CSS pipeline changes are needed for v0.
4. Add `JOBSMITH_CV_ROOT` env var to the README at repo root (or the `.env.example` if one exists).
5. Run lint + format with the repo's conventions before opening the PR.

## Known gaps (intentional, deferred to v0.1)

See `docs/jobsmith-v0.md` for the full deferred list. Headline:
- No PDF parsing.
- No LLM call.
- Heuristic JD parsing (warnings surfaced when detection fails).
- No persistence; corpus loads on each mount.

## Source

Written from `Z:\Other computers\My laptop\G\CV\` (mounted Drive). Hand-off doc `jobsmith-v0-builder-handoff.md` in the parent folder has the design rationale + voice profile observations.
