import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { AdminWorkers } from "./AdminEcosystemPages";

describe("AdminWorkers", () => {
  it("shows Jobs Manager as a first-class worker role", () => {
    render(React.createElement(AdminWorkers));

    expect(screen.getByRole("heading", { name: "Workers" })).toBeInTheDocument();
    expect(screen.getByText("📋 Jobs Manager")).toBeInTheDocument();
    expect(screen.getByText(/coordinator escalation/i)).toBeInTheDocument();
    expect(screen.getByText(/proof-to-done reconciliation/i)).toBeInTheDocument();
  });

  it("shows Engineering Steward as an architecture health worker role", () => {
    render(React.createElement(AdminWorkers));

    expect(screen.getByText("🧱 Engineering Steward")).toBeInTheDocument();
    expect(screen.getByText(/architecture health/i)).toBeInTheDocument();
    expect(screen.getByText(/scaling risks/i)).toBeInTheDocument();
  });
});
