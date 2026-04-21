import posthog from "posthog-js";

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com";

let initialized = false;

export function initPostHog(): void {
  if (initialized || !key) return;
  posthog.init(key, {
    api_host: host,
    autocapture: true,
    capture_pageview: true,
    persistence: "localStorage",
    respect_dnt: true,
  });
  initialized = true;
}

export { posthog };
