import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  useSession: () => ({
    session: { access_token: "test-session-token" },
    user: { email: "admin@example.com" },
    loading: false,
  }),
}));

function stubAdminProfileFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ is_admin: true }),
      }),
    ),
  );
}

async function renderAdminAnalytics() {
  const { default: AdminAnalytics } = await import("./AdminAnalytics");

  render(
    <MemoryRouter>
      <AdminAnalytics />
    </MemoryRouter>,
  );

  await screen.findByRole("heading", { name: "Analytics" });
}

describe("AdminAnalytics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_hidden_test_key");
    vi.stubEnv("VITE_POSTHOG_HOST", "https://us.i.posthog.com");
    vi.stubEnv("VITE_POSTHOG_DASHBOARD_CORE", "");
    vi.stubEnv("VITE_POSTHOG_DASHBOARD_TOOLS", "");
    vi.stubEnv("VITE_POSTHOG_DASHBOARD_AUTH", "");
    vi.stubEnv("VITE_POSTHOG_DASHBOARD_COHORTS", "");
    vi.stubEnv("VITE_POSTHOG_DASHBOARD_RETENTION", "");
    stubAdminProfileFetch();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows the empty dashboard setup state when no shared embeds are configured", async () => {
    await renderAdminAnalytics();

    expect(screen.getByText("Dashboard embed URLs not configured")).toBeInTheDocument();
    expect(screen.getByText("UnClick Core embed URL not set")).toBeInTheDocument();
    expect(screen.getByText("VITE_POSTHOG_DASHBOARD_CORE")).toBeInTheDocument();
  });

  it("reports analytics key presence without exposing the browser key value", async () => {
    await renderAdminAnalytics();

    expect(screen.getByText("Capture key configured")).toBeInTheDocument();
    expect(screen.getByText("A PostHog browser key is present in this build. Value is hidden.")).toBeInTheDocument();
    expect(screen.getByText("Read-only checks for analytics visibility. Key values are never shown.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("phc_hidden_test_key");
  });
});
