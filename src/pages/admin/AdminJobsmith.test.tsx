import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AdminJobsmith from "./AdminJobsmith";

describe("AdminJobsmith", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("blocks drafted claims until they cite a filled source fact", () => {
    render(React.createElement(AdminJobsmith));

    fireEvent.change(screen.getByLabelText("CV bullet"), {
      target: { value: "Led a redesign that improved conversion." },
    });

    expect(screen.getByLabelText("Truth ledger status for CV bullet")).toHaveTextContent("Blocked");
    expect(screen.getByText("Needs at least one source fact")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Achievement proof" }), {
      target: { value: "Portfolio case study records a before and after conversion improvement." },
    });
    fireEvent.click(screen.getByLabelText("CV bullet cites Achievement proof"));

    expect(screen.getByLabelText("Truth ledger status for CV bullet")).toHaveTextContent("Ready");
    expect(screen.getByText("1 source fact cited")).toBeInTheDocument();
  });

  it("shows blocked and risky ATS format checks for incomplete draft copy", () => {
    render(React.createElement(AdminJobsmith));

    fireEvent.change(screen.getByLabelText("CV bullet"), {
      target: { value: "Built a two-column PDF-only table for CV screening." },
    });

    expect(screen.getByLabelText("ATS and format risk preview")).toHaveTextContent("Blocked until basics are ready");
    expect(screen.getByText("Needs role facts and a captured job source")).toBeInTheDocument();
    expect(screen.getByText("Create a cited portal summary before portal copy is ready")).toBeInTheDocument();
    expect(screen.getByText("Mentions tables, columns, image-only, or scanned/PDF-only material")).toBeInTheDocument();
  });

  it("marks portal readiness ready when local source-backed copy is safe to paste", () => {
    render(React.createElement(AdminJobsmith));

    fireEvent.change(screen.getByLabelText("Job URL"), { target: { value: "https://example.com/job" } });
    fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Example Studio" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Senior Designer" } });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Melbourne" } });
    fireEvent.change(screen.getByLabelText("Level"), { target: { value: "Senior" } });
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "Referral" } });
    fireEvent.change(screen.getByLabelText("Likely ATS vendor"), { target: { value: "Greenhouse" } });
    fireEvent.click(screen.getByLabelText("Master CV"));

    fireEvent.change(screen.getByRole("textbox", { name: "Achievement proof" }), {
      target: { value: "Portfolio case study shows a shipped redesign with measurable product impact." },
    });
    fireEvent.change(screen.getByLabelText("Portal summary"), {
      target: { value: "Senior designer with shipped product redesign proof and portfolio evidence." },
    });
    fireEvent.click(screen.getByLabelText("Portal summary cites Achievement proof"));

    expect(screen.getByLabelText("ATS and format risk preview")).toHaveTextContent("Ready to copy with care");

    const portals = screen.getAllByTestId("jobsmith-portal-readiness");
    expect(within(portals[0]).getByText("Workday")).toBeInTheDocument();
    expect(portals[0]).toHaveTextContent("Ready");
    expect(within(portals[1]).getByText("Greenhouse")).toBeInTheDocument();
    expect(portals[1]).toHaveTextContent("Ready");
  });
});
