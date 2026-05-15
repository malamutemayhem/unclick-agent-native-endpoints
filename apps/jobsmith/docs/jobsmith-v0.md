# Jobsmith v0

A local, template-driven cover-letter drafter that uses Chris's CV corpus as the voice donor.

## What ships in v0

- `ingestCvCorpus()` — reads a local CV folder, returns a `Corpus` of dated CVs, cover letters, jobs applied to, and a ChatGPT prompt template. Parses `.txt` and `.md`; lists `.pdf` and `.indd` paths without parsing their bytes.
- `buildVoiceProfile(corpus)` — extracts a `VoiceProfile`: frequent phrases, opening/closing/sign-off formulas, role types, past brands, tonal adjectives, location & flexibility statements.
- `renderCoverLetterDraft(job, profile, options)` — composes a 5-paragraph cover letter draft from a job description + voice profile.
- `<JobsmithDraft />` — React page that ties it together.

## Run locally

Set the CV folder root via env:

```bash
# bash / zsh
export JOBSMITH_CV_ROOT="/path/to/CV"
```

For the React app (Vite/Next), expose it to the runtime appropriately, e.g.
`VITE_JOBSMITH_CV_ROOT` or `NEXT_PUBLIC_JOBSMITH_CV_ROOT`, and read it in
`JobsmithDraft.tsx` before calling `ingestCvCorpus`.

Run tests:

```bash
pnpm --filter jobsmith test
# or
npx vitest run
```

## Known limitations

- **No PDF/INDD parsing.** Most of the cover letter corpus is `.pdf` or `.indd`; v0 lists their paths but doesn't read their text. The 5 sample cover letters embedded in `ChatGPT Prompt Letter Generation.txt` carry most of the voice signal in v0. PDF parsing is the headline v0.1 feature.
- **Heuristic job description parsing.** v0 assumes the first non-empty line is the role and the second is the company. Unusual JD formats break this. The UI falls back to placeholders and surfaces a warning when detection fails.
- **No LLM call.** Phrasing comes from statistical extraction + templating. Drafts are starter copy, not finished letters — always edit before sending.
- **Brand seed list is hand-curated.** `voiceProfile.SEED_BRANDS` is a small list. Past employers not in the seed will be missed.

## Deferred to v0.1

1. PDF text extraction (probably `pdf-parse` server-side or `pdfjs-dist` browser-side).
2. Per-role-type template variants (Senior Designer vs. Content Designer use different middle paragraphs).
3. Recruitment-letter tone detection — different opener pattern (see lines 105–110 of the prompt template).
4. LLM polish pass (OpenAI/Claude API call to smooth the templated draft) — gated by an opt-in setting.
5. UnClick integration: file a draft as a comment against a UnClick todo for review.
6. Local persistence of the corpus (currently in-memory only).

## Test plan

| Module | Suite | Notes |
|---|---|---|
| `ingestCvCorpus` | `ingestCvCorpus.test.ts` | tmp-folder fixture mirroring the real shape |
| `voiceProfile` | `voiceProfile.test.ts` | in-memory Corpus with two synthetic cover letters |
| `renderDraft` | `renderDraft.test.ts` | Ampersand-style JD as input |
| `JobsmithDraft` page | not in v0 | UI smoke test in v0.1 with @testing-library/react |

## File map

```
apps/jobsmith/
├─ src/
│  ├─ lib/
│  │  ├─ ingestCvCorpus.ts
│  │  ├─ ingestCvCorpus.test.ts
│  │  ├─ voiceProfile.ts
│  │  ├─ voiceProfile.test.ts
│  │  ├─ renderDraft.ts
│  │  └─ renderDraft.test.ts
│  └─ pages/
│     └─ JobsmithDraft.tsx
└─ docs/
   └─ jobsmith-v0.md  (this file)
```

## Acceptance checklist (mirrors ScopePack v1 on UnClick todo 4bcb3169)

- [x] Corpus loads from `Z:\Other computers\My laptop\G\CV` (or env override).
- [x] `buildVoiceProfile` returns ≥5 frequent phrases (when corpus is large enough), ≥3 role types, ≥3 past brands.
- [x] `renderCoverLetterDraft` produces a non-empty draft on a real Jobs Applied input.
- [x] Tests pass (vitest).

If any of the above ship-blocks at integration time, the unit tests will surface it before the React page lands.
