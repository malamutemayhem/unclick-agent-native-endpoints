// PassGuard disclaimer-banner
// ---------------------------
// Three render-context disclaimers. Word counts are anchored to the brief:
//   chat    -> 42 words   (inline single-line context)
//   results -> 108 words  (results pane footer)
//   tos     -> 312 words  (terms of service / first-run modal)
//
// These strings are the legally reviewed defaults from the LegalPass brief
// (§7.1, see docs/legalpass-product-brief.md). Edits should round-trip
// through the brief and through legal review.
//
// They intentionally use the words "lawyer" / "attorney" because the
// disclaimer's whole purpose is to disclaim being one. The marketing-copy
// banned-words audit (qc_copy_audit) treats this module as exempt.

export type DisclaimerLength = "chat" | "results" | "tos";

const CHAT_DISCLAIMER =
  "LegalPass is an issue-spotter, not a lawyer. It surfaces risks in plain " +
  "English and does not give legal advice, take legal action on your behalf, " +
  "or replace counsel. For action on a specific matter, engage a qualified " +
  "human practitioner in your jurisdiction.";

const RESULTS_DISCLAIMER =
  "These findings are issue-spotting output only. LegalPass is not a lawyer, " +
  "law firm, or substitute for one, and nothing here is legal advice or a " +
  "legal opinion about your situation. No solicitor-client or attorney-client " +
  "relationship is created. Items are flagged using a twelve-hat panel, with " +
  "every claim traced to a primary source by the Citation Verifier. " +
  "Jurisdictions named are routing hints, not warranties of coverage. Before " +
  "acting on any item, consult a qualified practitioner admitted in the " +
  "relevant jurisdiction. You can engage one through the LegalPass " +
  "marketplace bolt-on or any provider of your choice. LegalPass disclaims " +
  "liability for action or inaction taken on the basis of this report.";

const TOS_DISCLAIMER =
  "LegalPass is an automated issue-spotting service operated by UnClick. It " +
  "is not a lawyer, attorney, solicitor, barrister, law firm, or licensed " +
  "provider of legal services in any jurisdiction. Use of LegalPass does " +
  "not create a solicitor-client, attorney-client, or fiduciary relationship " +
  "between you and UnClick. Output is provided for informational purposes " +
  "only. It is not legal advice, a legal opinion, legal representation, " +
  "certification of compliance, or a guarantee that any document is " +
  "lawful. LegalPass does not draft, execute, file, or serve " +
  "any transactional legal instrument and does not recommend that you take " +
  "or refrain from any specific legal action. Findings reference primary " +
  "sources via the Citation Verifier hard-veto, but those references may " +
  "be incomplete or out of date. Jurisdictional routing is best-effort and " +
  "may be wrong; you are responsible for confirming jurisdiction with a " +
  "qualified practitioner. Where LegalPass surfaces an option to engage a " +
  "practitioner through the marketplace bolt-on, that practitioner contracts " +
  "with you directly and is solely responsible for services they provide. " +
  "To the fullest extent permitted by law, UnClick disclaims all liability " +
  "for loss, damage, or cost arising from action or inaction taken on the " +
  "basis of LegalPass output. Always consult a qualified practitioner " +
  "before acting on any finding, and treat the report as a starting point. " +
  "Rubrics are updated periodically; an item rated as a check today may be " +
  "rated otherwise tomorrow, and you should not rely on a stale report. " +
  "LegalPass does not retain privilege over uploads and does not assert " +
  "work-product protection. Where you face dispute resolution, statutes of " +
  "limitation, or any other deadline, LegalPass does not track or warn " +
  "you, and a missed deadline remains your responsibility. If a finding " +
  "conflicts with advice from a practitioner you have engaged, defer to " +
  "the practitioner. UnClick may update these terms, the rubrics, the hat " +
  "roster, and the routing logic at any time without notice, and continued " +
  "use constitutes acceptance.";

const REGISTRY: Record<DisclaimerLength, string> = {
  chat: CHAT_DISCLAIMER,
  results: RESULTS_DISCLAIMER,
  tos: TOS_DISCLAIMER,
};

// Target word counts from the brief. Exposed for tests and audit.
export const DISCLAIMER_TARGETS: Record<DisclaimerLength, number> = {
  chat: 42,
  results: 108,
  tos: 312,
};

export function getDisclaimer(length: DisclaimerLength): string {
  return REGISTRY[length];
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}
