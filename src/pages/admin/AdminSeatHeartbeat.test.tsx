import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import AdminSeatHeartbeatPage, {
  HEARTBEAT_CONNECTION_PROMPT,
  HEARTBEAT_MASTER_PROMPT,
} from "./AdminSeatHeartbeat";

describe("AdminSeatHeartbeatPage", () => {
  it("shows the canonical policy and short schedule message", () => {
    render(React.createElement(AdminSeatHeartbeatPage));

    expect(screen.getByRole("heading", { name: "Heartbeat" })).toBeInTheDocument();
    expect(screen.getByLabelText("Public default heartbeat policy")).toHaveValue(HEARTBEAT_MASTER_PROMPT);
    expect(screen.getByLabelText("Short schedule message")).toHaveValue(HEARTBEAT_CONNECTION_PROMPT);
    expect(HEARTBEAT_CONNECTION_PROMPT).toContain("Run UnClick Heartbeat");
    expect(HEARTBEAT_CONNECTION_PROMPT).toContain("This authorizes writes");
    expect(HEARTBEAT_CONNECTION_PROMPT).toContain("admin_conversation_turn_ingest");
    expect(HEARTBEAT_CONNECTION_PROMPT).toContain("issue #693");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("include a brief progress summary");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("must stay self-contained");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("Do not POST to /admin/orchestrator");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("fallback proof write");
    expect(HEARTBEAT_CONNECTION_PROMPT.length).toBeLessThan(HEARTBEAT_MASTER_PROMPT.length / 2);
  });
});
