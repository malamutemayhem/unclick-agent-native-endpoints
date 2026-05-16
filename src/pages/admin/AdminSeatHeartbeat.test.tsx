import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import AdminSeatHeartbeatPage, {
  buildHeartbeatSchedulePrompt,
  HEARTBEAT_CONNECTION_PROMPT,
  HEARTBEAT_MASTER_PROMPT,
} from "./AdminSeatHeartbeat";

describe("AdminSeatHeartbeatPage", () => {
  it("shows the canonical policy and short schedule message", () => {
    render(React.createElement(AdminSeatHeartbeatPage));

    expect(screen.getByRole("heading", { name: "Heartbeat Master" })).toBeInTheDocument();
    expect(screen.getByText("❤️ UnClick Heartbeat")).toBeInTheDocument();
    expect(screen.getByLabelText("Public default heartbeat policy")).toHaveValue(HEARTBEAT_MASTER_PROMPT);
    expect(screen.getByLabelText("Base schedule message")).toHaveValue(HEARTBEAT_CONNECTION_PROMPT);
    expect(screen.getByLabelText("Heartbeat cadence")).toHaveValue("15");
    expect(screen.getByLabelText("Heartbeat schedule message preview")).toHaveValue(
      buildHeartbeatSchedulePrompt("15"),
    );
    expect(HEARTBEAT_CONNECTION_PROMPT).toContain("Run UnClick Heartbeat");
    expect(HEARTBEAT_CONNECTION_PROMPT).toContain("unclick-heartbeat-seat");
    expect(HEARTBEAT_CONNECTION_PROMPT).toContain("nudgeonly_receipt_bridge");
    expect(HEARTBEAT_CONNECTION_PROMPT).toContain("PushOnly");
    expect(HEARTBEAT_CONNECTION_PROMPT).toContain("compact public fields");
    expect(HEARTBEAT_CONNECTION_PROMPT).toContain("0 active jobs is PASS only if backlog is also 0");
    expect(HEARTBEAT_CONNECTION_PROMPT).toContain("Target existing Job Worker first");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("public policy must stay self-contained");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("master heartbeat");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("token-light");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("queue hydration failure");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("PinballWake JobHunt Mirror");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("Target the existing Job Worker");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("nudgeonly_receipt_bridge");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("pushonly_wake_pusher");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("bridge_id and receipt_line");
    expect(HEARTBEAT_MASTER_PROMPT).toContain("Do not POST to /admin/orchestrator");
    expect(HEARTBEAT_CONNECTION_PROMPT.length).toBeLessThan(HEARTBEAT_MASTER_PROMPT.length / 2);
  });

  it("updates the schedule message when cadence changes", () => {
    render(React.createElement(AdminSeatHeartbeatPage));

    fireEvent.change(screen.getByLabelText("Heartbeat cadence"), { target: { value: "30" } });

    expect(screen.getByLabelText("Heartbeat schedule message preview")).toHaveValue(
      buildHeartbeatSchedulePrompt("30"),
    );
    const preview = screen.getByLabelText("Heartbeat schedule message preview") as HTMLTextAreaElement;
    expect(preview.value).toContain("every 30 min");
  });

  it("keeps copied schedule text free of secret-shaped values and role override phrasing", () => {
    const prompt = buildHeartbeatSchedulePrompt("15");

    expect(prompt).toContain("Schedule ❤️ UnClick Heartbeat every 15 min");
    expect(prompt).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+/i);
    expect(prompt).not.toMatch(/sk-[A-Za-z0-9]{20,}/i);
    expect(prompt).not.toMatch(/[A-Za-z0-9+/]{32,}={0,2}/);
    expect(prompt).not.toMatch(/ignore (all )?(previous|prior) instructions/i);
    expect(prompt).not.toMatch(/developer mode|jailbreak/i);
  });
});
