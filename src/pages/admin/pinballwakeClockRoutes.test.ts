import { describe, expect, it } from "vitest";
import {
  PINBALLWAKE_CLOCK_ROUTES,
  summarizePinballWakeClockRoutes,
} from "./pinballwakeClockRoutes";

describe("PinballWake clock routes", () => {
  it("keeps QueuePush and WakePass as live non-destructive routes", () => {
    const queuepush = PINBALLWAKE_CLOCK_ROUTES.find((route) => route.id === "queuepush-pr-scanner");
    const wakepass = PINBALLWAKE_CLOCK_ROUTES.find((route) => route.id === "wakepass-ack-reclaim");

    expect(queuepush?.status).toBe("live");
    expect(queuepush?.safety).toMatch(/duplicate/i);
    expect(wakepass?.status).toBe("live");
    expect(wakepass?.safety).toMatch(/not destructive/i);
  });

  it("does not mark provider-key routes as live requirements", () => {
    const paidOrKeyedRoutes = PINBALLWAKE_CLOCK_ROUTES.filter((route) =>
      /OpenRouter|Groq|QStash|Cloudflare|Vercel/.test(`${route.name} ${route.technique}`),
    );

    expect(paidOrKeyedRoutes.length).toBeGreaterThan(0);
    expect(paidOrKeyedRoutes.every((route) => route.userRequired !== "None after setup.")).toBe(true);
  });

  it("summarizes the current clock ladder for the admin page", () => {
    const summary = summarizePinballWakeClockRoutes();

    expect(summary.total).toBe(PINBALLWAKE_CLOCK_ROUTES.length);
    expect(summary.automated).toBeGreaterThanOrEqual(4);
    expect(summary.byStatus.live).toBeGreaterThanOrEqual(3);
    expect(summary.byStatus.ready).toBeGreaterThanOrEqual(1);
  });
});
