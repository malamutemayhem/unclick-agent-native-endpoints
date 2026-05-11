import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import AdminBrainmap from "./AdminBrainmap";

describe("AdminBrainmap", () => {
  it("renders the generated ecosystem Brainmap with meaning attached", () => {
    render(React.createElement(AdminBrainmap));

    expect(screen.getByRole("heading", { name: "Ecosystem Brainmap" })).toBeInTheDocument();
    expect(screen.getByText("Internal admin only")).toBeInTheDocument();
    expect(screen.getAllByText("Pages and Meaning").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tool Families and Meaning").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Launchpad Route").length).toBeGreaterThan(0);
    expect(screen.getByText(/teaches seats what the system is/i)).toBeInTheDocument();
  });
});
