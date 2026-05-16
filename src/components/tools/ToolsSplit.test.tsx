import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import Tools from "../Tools";

vi.mock("../FadeIn", () => ({
  default: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  motion: new Proxy({}, {
    get: (_target, tag: string) => {
      const MotionComponent = ({ children, whileHover, transition, initial, animate, exit, ...props }: {
        children?: React.ReactNode;
        whileHover?: unknown;
        transition?: unknown;
        initial?: unknown;
        animate?: unknown;
        exit?: unknown;
      }) => React.createElement(tag, props, children);
      return MotionComponent;
    },
  }),
}));

describe("Tools split components", () => {
  it("keeps search, filters, local tools, and platform tools rendering", () => {
    render(<Tools />);

    expect(screen.getByPlaceholderText(/Search .* tools/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Local" })).toBeInTheDocument();
    expect(screen.getByText("Works out of the box")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Platform" }));

    expect(screen.getByText("Connect once. Works forever.")).toBeInTheDocument();
    expect(screen.getByText(/connectors$/i)).toBeInTheDocument();
  });
});
