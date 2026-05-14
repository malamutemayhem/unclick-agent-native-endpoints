import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import JobsmithPage from "./Jobsmith";

vi.mock("@/lib/auth", () => ({
  useSession: () => ({ session: null }),
}));

vi.mock("@/components/FadeIn", () => ({
  default: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

function renderJobsmith() {
  return render(
    <MemoryRouter initialEntries={["/jobsmith"]}>
      <JobsmithPage />
    </MemoryRouter>,
  );
}

describe("JobsmithPage", () => {
  it("blocks the starter packet until role basics and proof are present", () => {
    renderJobsmith();

    expect(screen.getByRole("heading", { name: "Application packet builder" })).toBeInTheDocument();
    expect(screen.getByText("Jobsmith")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Source-backed claim"), {
      target: { value: "Led a redesign that improved checkout completion." },
    });

    const packet = screen.getByRole("region", { name: "Starter packet" });
    expect(packet).toHaveTextContent("Packet locked");
    expect(packet).toHaveTextContent("Add company, role, and job source");
    expect(packet).toHaveTextContent("Add one claim and one source or proof note");
    expect(within(packet).getByRole("button", { name: "Copy packet" })).toBeDisabled();
  });

  it("builds a ready browser-local starter packet from one source-backed claim", () => {
    renderJobsmith();

    fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Example Studio" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Senior Product Designer" } });
    fireEvent.change(screen.getByLabelText("Job source"), { target: { value: "https://example.com/jobs/designer" } });
    fireEvent.change(screen.getByLabelText("Source-backed claim"), {
      target: { value: "Shipped a product redesign with documented conversion improvement." },
    });
    fireEvent.change(screen.getByLabelText("Source or proof note"), {
      target: { value: "Portfolio case study and CV project notes show the redesign proof." },
    });

    const readiness = screen.getByRole("region", { name: "ATS and paste readiness" });
    expect(readiness).toHaveTextContent("Ready");
    expect(readiness).toHaveTextContent("No brittle ATS formatting language detected");

    const packet = screen.getByRole("region", { name: "Starter packet" });
    const packetText = within(packet).getByTestId("jobsmith-public-packet-copy");
    expect(packet).toHaveTextContent("Ready");
    expect(packetText).toHaveTextContent("Starter packet: Senior Product Designer at Example Studio");
    expect(packetText).toHaveTextContent("- Job source: https://example.com/jobs/designer");
    expect(packetText).toHaveTextContent("- Claim proof: Portfolio case study and CV project notes show the redesign proof.");
    expect(packetText).toHaveTextContent("- Workday: Ready for careful field-by-field paste");
    expect(packetText).toHaveTextContent("No application is submitted and no external check is called.");
    expect(within(packet).getByRole("button", { name: "Copy packet" })).not.toBeDisabled();
    expect(screen.queryByText(/ApplyPass/i)).not.toBeInTheDocument();
  });
});
