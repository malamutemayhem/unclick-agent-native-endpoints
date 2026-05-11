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
    expect(HEARTBEAT_CONNECTION_PROMPT).toContain("unclick-heartbeat-seat");
    expect(HEARTBEAT_CONNECTION_PROMPT).toContain("nudgeonly_receipt_bridge");
    expect(HEARTBEAT_CONNECTION_PROMPT).toContain("compact public fields");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("public policy must stay self-contained");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("token-light");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("nudgeonly_receipt_bridge");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("bridge_id and receipt_line");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("Do not POST to /admin/orchestrator");
    expect(HEARTBEAT_CONNECTION_PROMPT.length).toBeLessThan(HEARTBEAT_MASTER_PROMPT.length / 2);
  });
});
