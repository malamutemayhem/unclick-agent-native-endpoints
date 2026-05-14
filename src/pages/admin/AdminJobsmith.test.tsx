import { fireEvent, render, screen } from "@testing-library/react";
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
});
