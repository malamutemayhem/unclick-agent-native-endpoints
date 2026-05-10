import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { highlightSearchText } from "./searchHighlight";

describe("highlightSearchText", () => {
  it("highlights exact keyword matches", () => {
    render(<p>{highlightSearchText("Orchestrator proof landed", "proof")}</p>);

    expect(screen.getByText("proof").tagName).toBe("MARK");
  });

  it("highlights typed letters for compact fuzzy matches", () => {
    render(<p>{highlightSearchText("Codex Orchestrator Seat", "cos")}</p>);

    const marked = Array.from(document.querySelectorAll("mark"))
      .map((node) => node.textContent)
      .join("");
    expect(marked.toLowerCase()).toContain("c");
    expect(marked.toLowerCase()).toContain("o");
    expect(marked.toLowerCase()).toContain("s");
  });
});
