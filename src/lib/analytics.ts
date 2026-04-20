/**
 * Analytics helper — thin wrapper around Umami's window.umami.track().
 *
 * The Umami snippet is loaded async in index.html with data-website-id
 * 724975a0-999c-4006-b238-19ee7182c25b, pointed at
 * https://analytics.unclick.world. It attaches window.umami with a
 * .track(eventName, eventData?) function once it finishes loading.
 *
 * This helper is safe to call before the script has loaded, in dev
 * environments without the script, and in tests — it no-ops instead
 * of throwing. Every failure mode is swallowed so analytics can never
 * break the app.
 *
 * Usage:
 *   track("signup_started", { method: "magic" });
 *   track("auth_success",   { new_user: true, provider: "google" });
 */

type EventData = Record<string, string | number | boolean | null | undefined>;

interface UmamiWindow {
  umami?: {
    track?: (event: string, data?: EventData) => void;
  };
}

export function track(event: string, data?: EventData): void {
  if (typeof window === "undefined") return;
  try {
    const umami = (window as unknown as UmamiWindow).umami;
    if (umami && typeof umami.track === "function") {
      umami.track(event, data);
    }
  } catch {
    // Never let analytics break the app.
  }
}
