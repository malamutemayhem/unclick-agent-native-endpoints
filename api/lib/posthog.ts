import { PostHog } from "posthog-node";

const apiKey = process.env.POSTHOG_API_KEY;
const host = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

let client: PostHog | null = null;

export function getPostHogClient(): PostHog | null {
  if (!apiKey) return null;
  if (!client) {
    client = new PostHog(apiKey, { host });
  }
  return client;
}

export function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): void {
  const ph = getPostHogClient();
  if (!ph) return;
  ph.capture({ distinctId, event, properties: properties ?? {} });
}
