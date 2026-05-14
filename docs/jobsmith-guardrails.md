# Jobsmith Guardrails

Jobsmith exists to help people apply for real jobs honestly. These guardrails are product rules, not marketing notes.

## Naming

- Use **Jobsmith** in all product, repo, Jobs room, GitHub, UI, and docs surfaces.
- Treat older names in research files as source context only.
- Do not create dual branding or transition copy unless Chris asks for it.

## Truth First

Jobsmith must never invent:

- Employers.
- Titles.
- Dates.
- Degrees.
- Certifications.
- Referrals.
- Salary history.
- Metrics.
- Portfolio evidence.
- Tool experience.
- Team size.
- Business outcomes.

Every generated claim must map to `source_cv_facts`, portfolio evidence, or a user-approved note. Unsupported claims are blocked until the user supplies evidence.

## Interview-Defensible Standard

Before a claim appears in a CV, cover letter, email, or portal answer, ask:

Could the applicant defend this clearly in an interview?

If the answer is no, Jobsmith should revise, weaken, cite the missing evidence, or block the claim. Specific language is good. Inflated language is not.

## No ATS Abuse

Allowed:

- Clear standard headings.
- Single-column layout.
- Plain date formats.
- Role-relevant keywords used in context.
- Text-based DOCX, PDF, and plain text exports.
- Parse self-tests and vendor-specific lint.

Blocked:

- Hidden text.
- White-on-white text.
- Keyword stuffing.
- Repeated skill spam.
- Image-only CVs.
- Misleading headings.
- Fake role matching.
- Claims designed only for a scanner and not for a human reader.

ATS risk is a review signal, not a promise that an application will rank or pass.

## No Detector Evasion

Jobsmith must not include:

- Humaniser mode.
- AI detector bypass mode.
- Fake typos.
- Random awkwardness.
- Prompted imperfection.
- Rewriting whose goal is to beat a detector score.

Detector checks, if included, are optional false-positive risk awareness only. They must be clearly labeled as weak, noisy, and potentially biased signals.

## Redaction Before External Checks

Never submit a real CV, cover letter, email, or profile containing personal or sensitive details to a public detector or external checker.

Before any optional external check:

- Remove name, email, phone, address, and account handles.
- Remove employer names if they identify the applicant too strongly.
- Remove project codenames, client names, and private portfolio details.
- Remove references, recruiter details, and application IDs.
- Show the user exactly what would leave the system.
- Block the call if redaction is incomplete.

Record a redaction receipt with what was removed, where the redacted copy went, when, and which rule version allowed it.

## Privacy And Retention

Default posture:

- No secrets in logs.
- No training on user data without a separate explicit opt-in.
- User-controlled deletion and export.
- Minimal third-party sharing.
- Generated assets retained only as long as useful.
- Source facts retained only with user control and clear explanation.

Recommended defaults:

- Generated assets: 90 days.
- Source facts: 365 days.
- Audit and rule receipts: retained as proof unless user deletion requires removal.

## Age And Over-Seniority Lens

Jobsmith may reduce unnecessary age or over-seniority signals by:

- Removing graduation dates when not needed.
- Compressing older early-career detail.
- Highlighting recent, relevant proof first.
- Matching seniority tone to the actual role.
- Avoiding founder-heavy or overqualified framing where it hurts fit.

Jobsmith must not lie about dates, omit legally relevant facts, invent junior experience, or disguise the applicant's real background. The lens is about relevance and emphasis.

## Voice Preservation

Voice preservation means grounded, natural writing based on the applicant's own samples.

Allowed:

- Prefer plain English.
- Preserve sentence rhythm where useful.
- Replace generic AI phrases with specific evidence.
- Use domain-appropriate tone.
- Flag language the applicant would not naturally say.

Blocked:

- Fake personal quirks.
- Artificial mistakes.
- Over-casual language that misrepresents the applicant.
- Style transfer that erases the user's professional identity.

## Rule Updates

Hiring tools, ATS parsers, AI detector claims, and employment AI rules change often. Jobsmith rules must be versioned.

Each rule update needs:

- Source.
- Date checked.
- Jurisdiction or vendor if relevant.
- What changed.
- Why it changed.
- Approval level.
- Rollback note.

Human review is required for any rule that changes redaction behaviour, ethical policy, export format, or user-facing risk wording.

## Build Boundaries

Do not build in v0 without a narrower ScopePack:

- Mass auto-apply.
- Recruiter CRM.
- Job board.
- LinkedIn automation.
- Interview-prep suite.
- Public billing.
- External detector integrations that handle unredacted text.
- Training pipeline over user documents.
- Production data migrations.

Do not touch:

- Secrets.
- Billing.
- DNS.
- Production deploys.
- Data deletion.
- Force pushes.
- New schedules outside the existing UnClick heartbeat policy.

## Open Source Use

Open-source projects can inform export or parsing plumbing only after a license and fit check.

Rules:

- No copied competitor UI.
- No copied templates without license proof.
- No dependencies with unclear data handling.
- No license that conflicts with UnClick's distribution model.
- Record borrowed code, license, source URL, and reason in the implementation PR.

## Release Gate

Before any user can rely on Jobsmith output:

- Generated claims must have a source trace.
- Unsupported claims must be blocked or clearly marked.
- Redaction receipt must show zero unredacted external detector calls.
- Export parse self-test must pass the target portal profile.
- User must approve final materials before send.
- Outcome tracking must be available for dogfood learning.
