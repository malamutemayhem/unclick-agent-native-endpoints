/**
 * ConversationalCard - the response shape every UnClick MCP tool can attach
 * alongside its raw payload so chat surfaces (the Wizard, Claude Desktop,
 * ChatGPT, anything else) can render a friendly card instead of dumping JSON
 * at the user.
 *
 * Phase 1 deliverable. See docs/wizard-phase-1-spec.md.
 *
 * Design rules:
 *   - Pure types, zero runtime deps. Anything that imports this stays cheap.
 *   - Backward compatible by construction: a tool's existing payload stays
 *     where it was and the card sits next to it as an optional field.
 *   - Renderable without a schema lookup. A surface that does not know the
 *     calling tool should still be able to render the card.
 */

export type CardSeverity = "info" | "success" | "warning" | "error";

/**
 * A single body block inside a card. Surfaces render each block top to bottom.
 * Phase 1 supports five kinds. New kinds may be added in later phases; renderers
 * MUST treat unknown kinds as opaque and fall back to plain text.
 */
export type CardSection =
  | CardTextSection
  | CardListSection
  | CardTableSection
  | CardLinkSection
  | CardActionButtonSection;

export interface CardTextSection {
  kind: "text";
  /** Optional heading shown above the text block. */
  heading?: string;
  /** Plain text or lightweight markdown. No HTML. */
  text: string;
}

export interface CardListSection {
  kind: "list";
  heading?: string;
  /** Render as a bulleted list. Use ordered=true for numbered. */
  items: string[];
  ordered?: boolean;
}

export interface CardTableSection {
  kind: "table";
  heading?: string;
  /** Column headings, in display order. */
  columns: string[];
  /** Rows, each the same length as columns. Cells are stringified for display. */
  rows: Array<Array<string | number | boolean | null>>;
}

export interface CardLinkSection {
  kind: "link";
  heading?: string;
  /** Visible label for the link. */
  label: string;
  /** Absolute URL or app-relative deep link (e.g. "/admin/memory"). */
  href: string;
  /** Optional one-line description shown beneath the link. */
  description?: string;
}

/**
 * A clickable action that maps to a follow-up tool call. The surface is
 * responsible for invoking the tool with the supplied arguments. Carries no
 * runtime behavior of its own.
 */
export interface CardActionButtonSection {
  kind: "action-button";
  heading?: string;
  /** Button label shown to the user. */
  label: string;
  /** Optional one-line hint shown alongside the button. */
  description?: string;
  action: CardAction;
}

export interface CardAction {
  /** MCP tool name to invoke when the action is taken. */
  tool: string;
  /** Arguments to pass to the tool. Surface MAY prompt for confirmation first. */
  args: Record<string, unknown>;
  /**
   * If "confirm", the surface should ask the user before invoking the tool.
   * If "auto", the surface may invoke directly. Defaults to "confirm".
   */
  confirmation?: "confirm" | "auto";
}

/**
 * The full card. Every field except title and summary is optional so tools
 * can ship the simplest useful card on day one and grow into richer bodies
 * later.
 */
export interface ConversationalCard {
  /** Short headline. Surfaces render as the card's bold top line. */
  title: string;
  /** One or two sentence plain-English summary of the result. */
  summary: string;
  /** Severity hint for icon and color. Defaults to "info" if omitted. */
  severity?: CardSeverity;
  /** Body sections rendered in order. */
  body?: CardSection[];
  /**
   * Suggested follow-ups the agent may offer the user. Each is a short
   * imperative phrase plus an optional action that wires it to a tool call.
   */
  followUps?: CardFollowUp[];
  /**
   * Free-form metadata for surfaces that want to deduplicate or correlate
   * cards. Not user-visible. Keep small.
   */
  meta?: Record<string, string | number | boolean>;
}

export interface CardFollowUp {
  /** Imperative label the surface shows to the user. */
  label: string;
  /** Optional tool action wired to the follow-up. */
  action?: CardAction;
}

/**
 * Helper type for tool responses that opt into the card layer. Tools should
 * keep their existing payload shape on the `results` field and attach the
 * card alongside.
 */
export interface WithCard<T> {
  results: T;
  card: ConversationalCard;
}
