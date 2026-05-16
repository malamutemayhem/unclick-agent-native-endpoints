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
  signOut: vi.fn(),
}));

function stubAdminFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("admin_profile")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ is_admin: true }),
        });
      }
      if (url.includes("list_signals")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ signals: [] }),
        });
      }
      if (url.includes("admin_check_connection")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              connected: true,
              configured: true,
              has_context: true,
              context_count: 1,
              fact_count: 1,
              last_session: null,
              last_used_at: null,
            }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }),
  );
}

describe("AdminShell navigation", () => {
  beforeEach(() => {
    vi.resetModules();
    stubAdminFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps Analytics only inside the yellow Admin submenu", async () => {
    const { default: AdminShell } = await import("./AdminShell");

    render(
      <MemoryRouter initialEntries={["/admin/analytics"]}>
        <AdminShell />
      </MemoryRouter>,
    );

    const analyticsLinks = await screen.findAllByRole("link", { name: "Analytics" });
    expect(analyticsLinks).toHaveLength(1);
    expect(analyticsLinks[0]).toHaveAttribute("href", "/admin/analytics");
    expect(screen.getAllByRole("button", { name: "Admin" }).length).toBeGreaterThan(0);
  });
});
