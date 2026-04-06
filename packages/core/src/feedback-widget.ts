/**
 * Feedback widget helper : drop this pattern into any UnClick frontend.
 *
 * Usage in React/Next.js/any framework:
 *
 *   import { submitFeedback, FeedbackType } from '@unclick/core/feedback-widget'
 *
 *   // Minimal "Report issue" footer link:
 *   <button onClick={() => setOpen(true)} style={{ opacity: 0.5, fontSize: '12px' }}>
 *     Report issue
 *   </button>
 *
 * The widget is intentionally design-free : drop the submit function into
 * whatever UI you want. A minimal footer link is the recommended pattern:
 * small, unobtrusive, but always present.
 */

export type FeedbackType = 'bug' | 'feature' | 'feedback';

export interface FeedbackPayload {
  type: FeedbackType;
  description: string;
  email?: string;
  tool?: string;      // e.g. 'links', 'schedule'
  endpoint?: string;  // current URL
  metadata?: Record<string, unknown>;
}

export interface FeedbackResult {
  id: string;
  type: FeedbackType;
  status: 'open';
  created_at: string;
}

/**
 * Submit feedback to the UnClick API.
 * Call this from your "Report issue" handler.
 */
export async function submitFeedback(
  payload: FeedbackPayload,
  apiBase = 'https://api.unclick.world',
): Promise<FeedbackResult> {
  const res = await fetch(`${apiBase}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      endpoint: payload.endpoint ?? (typeof window !== 'undefined' ? window.location.href : undefined),
      metadata: {
        ...payload.metadata,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? 'Failed to submit feedback');
  }

  const json = await res.json() as { data: FeedbackResult };
  return json.data;
}

/**
 * Minimal footer link markup (framework-agnostic HTML string).
 * Style it with opacity + small font in your footer.
 *
 * Example CSS:
 *   .feedback-link { opacity: 0.4; font-size: 11px; color: inherit; }
 *   .feedback-link:hover { opacity: 0.7; }
 */
export const FEEDBACK_LINK_MARKUP = `
<a href="#" class="feedback-link" data-feedback-trigger>Report issue</a>
`.trim();
