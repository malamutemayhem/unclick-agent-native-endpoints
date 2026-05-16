import type React from "react";

export type ToolCategory =
  | "Utility"
  | "Text"
  | "Data"
  | "Media"
  | "Network"
  | "Security"
  | "Storage"
  | "Platform"
  | "Social"
  | "Commerce";

export type Category = "All" | "Local" | "Platform" | ToolCategory;

export interface Tool {
  name: string;
  description: string;
  endpoint: string;
  category: ToolCategory;
  Icon: React.ElementType;
  capabilities: string[];
  examplePrompt: string;
}

export type TestPassScore = {
  score: number;
  pass: number;
  fail: number;
  total: number;
  status?: string;
};

export type ConnectorStatus = Record<string, "connected" | "not-connected">;
