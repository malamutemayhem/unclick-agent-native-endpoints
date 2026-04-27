# LegalPass product brief (condensed)

> Condensed companion to the full ~1700-line brief that lives in Chris's
> uploads and in UnClick Memory facts (`b1e44cc5`, `f179fa2b`, `9e1089ae`,
> `25b1ea77`). When the two disagree, the long brief wins.

## 1. Positioning

LegalPass is the **6th Pass family product** alongside TestPass, UXPass,
FlowPass, SecurityPass, and BackstagePass.

- **Hero:** *The legal pass for AI-native teams. Twelve checks. One verdict. Plain English.*
- **Slogan:** *Twelve hats. One verdict.*
- **Buyer:** founders + in-house counsel + ops at AI-native startups. **Not BigLaw.**
- **Output:** plain-English issue-spot report, every claim traced to a primary source.

## 2. White space

LegalPass sits between two existing categories that do not overlap:

1. Generic AI chat (ChatGPT, Claude). Will happily produce something that
   looks like legal advice but ducks accountability and never traces to
   sources.
2. Traditional legaltech (DoNotPay, Ironclad, Robin AI, BigLaw retainers).
   Either targets enterprise procurement or holds itself out as a
   substitute for counsel and absorbs the regulatory exposure.

The gap is a panel-of-experts issue-spotter that openly declines to be a
lawyer, traces every claim, and routes the user to a real practitioner
through a marketplace when action is needed.

## 3. UPL risk and the immutable design rule

The single biggest existential risk to a product like LegalPass is
**unauthorised practice of law (UPL)** under the various state and
national bar rules. The mitigation is architectural, not marketing.

**IMMUTABLE DESIGN RULE** (parallel to SecurityPass's *PoC never auto-fired*):

> LegalPass NEVER produces output that is a transactional legal
> instrument tailored to the specific user. NEVER gives a recommendation
> to take or refrain from a specific legal action. NEVER holds itself out
> as a lawyer or substitute for a lawyer. Outputs are issue-spotters and
> information only. All action taken by user or by real practitioner
> engaged through marketplace.

This rule is enforced at three layers:

1. **Verdict-linter** at render time (`packages/legalpass/src/passguard/verdict-linter.ts`)
   bans directive verbs in any verdict text: `should`, `must`, `you need to`,
   `you have to`, `we recommend`, `this is illegal`, `you will win`, `you will lose`.
   Allowed framing: `appears`, `may`, `consider`, `in similar contracts`, `warrants review`.
2. **Disclaimer banner** present in three render contexts (chat / results / ToS).
3. **Marketing copy audit** (`qc_copy_audit`, lives outside this PR) bans the
   words `lawyer`, `attorney`, `counsel`, `legal advice`, `legal opinion`,
   `legal representation`, `robot lawyer`, `AI lawyer`, `law firm`, `client`,
   `attorney-client privilege`, `we will defend you`, `sue`, `guarantee compliance`,
   `100% compliant`. The disclaimer-banner module is exempt (it must use the
   word "lawyer" to disclaim being one).

## 4. The 12-hat panel

| # | Hat | Role |
|---|-----|------|
| 1 | Privacy | GDPR / Privacy Act / CCPA disclosures, retention, transfers |
| 2 | Consumer / ToS Unfair Terms | ACL, UCTA, EU Directive 93/13 patterns |
| 3 | Contracts | indemnity, limitation of liability, termination, IP assignment |
| 4 | Open Source Licence | copyleft cascade, attribution, patent-grant interactions |
| 5 | AI Ethics | EU AI Act tier, model-card hygiene, training-data provenance |
| 6 | IP | trade-mark conflicts, copyright, moral rights |
| 7 | Marketing Claims | misleading-conduct, comparative claims, endorsements |
| 8 | Litigator | adversarial read for likely arguments against the user |
| 9 | Plain-English | rewrites every finding for a non-lawyer reader |
| 10 | Compliance | sector overlays (fintech, health, education) |
| 11 | Jurisdiction Router | maps claims to the correct primary source per region |
| 12 | Citation Verifier | **hard-veto**: every claim must trace to a primary source or it is dropped |

The Citation Verifier is the only hat with veto power. A finding that
clears the other eleven but fails citation is removed from the verdict.

## 5. Jurisdiction map

Phase 1 MVP covers **AU, EU, US-CA**. Phase 2 adds **UK, US-NY, CA, NZ, SG**.
The Jurisdiction Router maps each finding to the correct primary source
for the resolved jurisdiction; ambiguous routing returns a `pending`
verdict with a routing note rather than guessing.

## 6. MVP scope (6 to 8 weeks)

- **Hats live:** Privacy, Consumer / ToS Unfair Terms, OSS Licence, Contracts (4 of 12)
- **Jurisdictions:** AU + EU + US-CA
- **Tiers live:** Free + Solo
- **Surface:** badge embed for sites, MCP tools for agents
- **Citation Verifier:** hard-veto active from day one (not a Phase 2 add)

## 7. Pricing (AUD per month)

| Tier | Price | Quota | Bolt-ons |
|------|-------|-------|----------|
| Free | $0 | 3 scans / month | n/a |
| Solo | $29 | 25 scans / month | $9 per extra scan |
| Team | $99 | 150 scans / month | $9 per extra scan |
| Scale | $299 | 750 scans / month | $9 per extra scan |
| Human-practitioner bolt-on | $149 per matter | n/a | marketplace fee |

## 8. Slogan candidates (for reference)

- *Twelve hats. One verdict.* (locked)
- *The legal pass for AI-native teams.*
- *Plain English. Primary sources. No legal advice.*
- *Issue-spotter, not advisor.*

## 9. Disclaimer drafts (verbatim, ready to ship)

These match `packages/legalpass/src/passguard/disclaimer-banner.ts`. Word
counts: chat 42, results 108, ToS 312. Edits round-trip through both
files and through legal review.

### 9.1 Chat (42 words)

> LegalPass is an issue-spotter, not a lawyer. It surfaces risks in plain English and does not give legal advice, take legal action on your behalf, or replace counsel. For action on a specific matter, engage a qualified human practitioner in your jurisdiction.

### 9.2 Results (108 words)

> These findings are issue-spotting output only. LegalPass is not a lawyer, law firm, or substitute for one, and nothing here is legal advice or a legal opinion about your situation. No solicitor-client or attorney-client relationship is created. Items are flagged using a twelve-hat panel, with every claim traced to a primary source by the Citation Verifier. Jurisdictions named are routing hints, not warranties of coverage. Before acting on any item, consult a qualified practitioner admitted in the relevant jurisdiction. You can engage one through the LegalPass marketplace bolt-on or any provider of your choice. LegalPass disclaims liability for action or inaction taken on the basis of this report.

### 9.3 ToS (312 words)

> LegalPass is an automated issue-spotting service operated by UnClick. It is not a lawyer, attorney, solicitor, barrister, law firm, or licensed provider of legal services in any jurisdiction. Use of LegalPass does not create a solicitor-client, attorney-client, or fiduciary relationship between you and UnClick. Output is provided for informational purposes only. It is not legal advice, a legal opinion, legal representation, certification of compliance, or a guarantee that any document is lawful. LegalPass does not draft, execute, file, or serve any transactional legal instrument and does not recommend that you take or refrain from any specific legal action. Findings reference primary sources via the Citation Verifier hard-veto, but those references may be incomplete or out of date. Jurisdictional routing is best-effort and may be wrong; you are responsible for confirming jurisdiction with a qualified practitioner. Where LegalPass surfaces an option to engage a practitioner through the marketplace bolt-on, that practitioner contracts with you directly and is solely responsible for services they provide. To the fullest extent permitted by law, UnClick disclaims all liability for loss, damage, or cost arising from action or inaction taken on the basis of LegalPass output. Always consult a qualified practitioner before acting on any finding, and treat the report as a starting point. Rubrics are updated periodically; an item rated as a check today may be rated otherwise tomorrow, and you should not rely on a stale report. LegalPass does not retain privilege over uploads and does not assert work-product protection. Where you face dispute resolution, statutes of limitation, or any other deadline, LegalPass does not track or warn you, and a missed deadline remains your responsibility. If a finding conflicts with advice from a practitioner you have engaged, defer to the practitioner. UnClick may update these terms, the rubrics, the hat roster, and the routing logic at any time without notice, and continued use constitutes acceptance.

## 10. Cross-Pass architecture: PassGuard

Several CYA components in this PR (verdict-linter, disclaimer-banner) are
designed to be lifted out into a shared `PassGuard` package for the whole
Pass family. Tracked separately as a follow-up chunk. Nine planned shared
components: verdict-linter, disclaimer-banner, escalation-router,
action-gate, audit-log, insurance-rider-map, ToS-shared,
jurisdiction-resolver, consent-ledger.

## 11. Out of scope for this brief

Pricing experiments, marketplace economics, Phase 2 jurisdictions,
Phase 2 hats (5 through 12), and the full bar-rule mapping per
jurisdiction are covered in the long brief.
