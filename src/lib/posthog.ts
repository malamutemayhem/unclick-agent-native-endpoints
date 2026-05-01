import posthog from "posthog-js";

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com";

let initialized = false;

export function initPostHog(): void {
  if (initialized || !key) return;
  posthog.init(key, {
    api_host: host,
    defaults: "2026-01-30",
    autocapture: true,
    capture_pageview: false,
    capture_pageleave: false,
    persistence: "localStorage",
    respect_dnt: true,
  });
  initialized = true;
}

export { posthog };
