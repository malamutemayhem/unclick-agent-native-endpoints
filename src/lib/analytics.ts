import { posthog } from "./posthog";

/**
 * Analytics helper. PostHog is the primary client-side analytics path.
 * Umami is kept as an optional compatibility fallback in case the old
 * self-hosted script is restored later. Every failure mode is swallowed so
 * analytics can never break the app.
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
    posthog.capture(event, data);
    const umami = (window as unknown as UmamiWindow).umami;
    if (umami && typeof umami.track === "function") {
      umami.track(event, data);
    }
  } catch {
    // Never let analytics break the app.
  }
}

export function trackPageView(path: string): void {
  if (typeof window === "undefined") return;
  try {
    const properties = {
      path,
      title: document.title || undefined,
      $current_url: window.location.href,
      $pathname: path,
    };
    posthog.capture("$pageview", properties);
    const umami = (window as unknown as UmamiWindow).umami;
    if (umami && typeof umami.track === "function") {
      umami.track("pageview", properties);
    }
  } catch {
    // Never let analytics break the app.
  }
}
