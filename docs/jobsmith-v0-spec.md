# Jobsmith v0 Spec

Jobsmith is the UnClick application workshop for real job applications. It helps a person turn verified career facts into role-specific CVs, cover letters, short emails, and portal copy without fake claims, hidden text, keyword stuffing, or detector evasion.

Source context:

- `C:\G\MalamuteMayhem\Jobs\UnClick\Context\Deep Researches\CV_research_2_2.md`
- `C:\G\MalamuteMayhem\Jobs\UnClick\Context\Deep Researches\CV_research_1_2.md`
- Jobs todo `4bcb3169-54a6-4ed9-bb14-8b20f01c98ba`
- GitHub issue `#779`

The research files use an older working name. The product, docs, Jobs room, GitHub surfaces, UI, and user-facing copy must use **Jobsmith**.

## Positioning

Jobsmith is not an ATS-hacking tool and not a generic AI resume writer. It is a truthful application workshop built around four promises:

- Every generated claim traces back to an applicant source fact.
- Every draft is written so the applicant can defend it in an interview.
- Every external check is privacy-aware and redacted first.
- Every sent application becomes learning evidence for the next one.

The market gap is the space between template resume builders, ATS score tools, mass auto-apply products, and generic AI rewriters. Jobsmith should win by combining grounded tailoring, applicant voice, privacy receipts, and outcome learning.

## First User

Chris is the first user and dogfood loop. v0 should support one applicant well before it tries to support every applicant.

First-user needs:

- Capture a job in under 60 seconds from a URL, pasted description, or recruiter note.
- Reuse a trusted master CV, skills list, timeline, portfolio links, LinkedIn export, and voice samples.
- Generate application materials that are specific, plain, and interview-defensible.
- Reduce avoidable age and over-seniority signals while preserving honest history.
- Export material that survives Workday, Greenhouse, Lever, and manual portal copy-paste.
- Record outcome signals after silence, rejection, interview, offer, or user revision.

## Product Slices

### Phase 0: Spec and Guardrails

Ship this spec and `docs/jobsmith-guardrails.md`. The docs define naming, scope, risks, feature slices, data shape, and stop conditions before app code starts.

### Phase 1: Admin Job Capture and Manual Wizard

Build an internal admin-first flow for Chris:

- Add job by URL, pasted description, or manual notes.
- Capture company, role, salary, location, closing date, level, recruiter, source, and likely ATS vendor.
- Attach source materials: master CV, portfolio links, writing samples, role history, skills, and notes.
- Produce a manual tailoring plan before generation.

### Phase 2: Source Facts and Truth Ledger

Create a structured source record before any generated content:

- `source_cv_facts`: atomic role, employer, date, achievement, skill, project, portfolio, education, and credential facts.
- `claim_ledger`: every generated bullet, paragraph, or email claim maps to one or more source facts.
- `unsupported_claims`: blocked claims that need user evidence before use.
- `interview_defensible`: a boolean and note for claims that can survive a recruiter or hiring-manager question.

### Phase 3: Tailoring and Voice

Generate:

- ATS-safe CV draft.
- Cover letter.
- Short application email.
- Portal copy chunks for Workday, Greenhouse, Lever, and manual fields.
- Portfolio proof pack mapping claims to case studies, projects, or examples.

Voice preservation should use real writing samples to avoid generic AI tone. It must improve specificity and natural rhythm without adding fake imperfections or detector-evasion tricks.

### Phase 4: Risk Dashboard

Show practical risks before send:

- Truthfulness risk: unsupported, inflated, vague, or interview-fragile claims.
- ATS and formatting risk: columns, headings, date formats, tables, images, file type, and parse self-test output.
- Tone risk: generic AI phrases, corporate fluff, over-polish, or weak opening evidence.
- Age and over-seniority risk: unnecessary graduation dates, excessive early-career detail, or role-level mismatch.
- Detector false-positive risk: optional and redacted-only, framed as weak signal awareness.
- Privacy risk: what would leave the machine and why.

### Phase 5: Exports

v0 export targets:

- DOCX as the safest default for ATS portals.
- Text-based PDF for non-portal use.
- Plain text for paste fields and parse self-tests.
- Portal copy kit with summary, achievements, skills, short motivation, and email body.

Avoid design-heavy layouts, image PDFs, hidden text, and unusual headings.

### Phase 6: Outcome Learning

After each application, capture:

- Sent date.
- Materials used.
- Recruiter or portal notes.
- Silence, rejection, interview, offer, or withdrawal.
- User edits before send.
- Lessons for rules, voice, claims, or formatting.

Outcome learning should improve recommendations, not silently rewrite policy. Rule changes need source, date, reason, and approval level.

## Minimal Data Outline

- `applicant_profile`
- `source_cv_facts`
- `job_description`
- `company_profile`
- `tailoring_notes`
- `generated_assets`
- `claim_ledger`
- `risk_reports`
- `redacted_detector_copy`
- `source_links`
- `rule_versions`
- `application_status`

Generated assets should be reproducible from source facts, job description, rule version, and user-approved style settings.

## Build Vs Borrow Audit

Phase 0 should record a build-vs-borrow check before implementation. Open-source resume/CV projects can be inspected for parsing ideas, export plumbing, and schema inspiration only if license, quality, maintenance, and product fit are clean.

Rules:

- No copied competitor branding, UI, templates, or flows.
- No dependency that forces user CV data through unknown external services.
- Browser-local or permissively licensed parsing ideas may be useful, but Jobsmith remains UnClick-native unless a specific dependency passes review.
- Any borrowed code needs license proof and a narrow integration note.

## Acceptance

Phase 0 is accepted when:

- This spec and `docs/jobsmith-guardrails.md` exist in the repo.
- The docs cite the two research files as source context.
- Public naming is locked to Jobsmith.
- The first app-code PR can choose exact app and package paths from these docs without rereading the research.
- Guardrails clearly block fake claims, hidden text, keyword stuffing, detector evasion, unredacted detector calls, mass auto-apply, and user-data training without opt-in.

Future product acceptance:

- Chris can capture a job in under 60 seconds.
- Generated CV, cover letter, and email drafts contain zero unsupported claims.
- DOCX, text-based PDF, and plain-text exports pass Workday, Greenhouse, and Lever parse self-tests.
- Redaction audit shows zero unredacted external detector calls.
- Five real Chris applications run end to end and outcomes are captured.

## Non Goals

v0 does not include:

- Mass auto-apply.
- Recruiter CRM.
- Full job board.
- Interview prep suite.
- LinkedIn auto-posting.
- Multi-language output.
- Mobile-native app.
- Detector evasion or humaniser features.
- Billing or public growth loops before dogfood proof.

## Next Implementation Slice

The next PR after Phase 0 should inspect the current repo and choose the smallest admin-first path. A likely slice is:

- One Jobsmith admin route or panel.
- Job capture form.
- Source material placeholders.
- Manual tailoring plan model.
- No generation engine yet unless the spec receives a narrower ScopePack.
