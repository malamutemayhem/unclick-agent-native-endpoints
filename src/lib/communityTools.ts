export const CATEGORIES = [
  "Utility",
  "Text",
  "Data",
  "Media",
  "Network",
  "Security",
  "Storage",
  "Platform",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface CommunityTool {
  id: string;
  name: string;
  endpointUrl: string;
  description: string;
  category: Category;
  docsUrl?: string;
  githubUrl?: string;
  healthStatus: "live" | "under-review";
  submittedAt: string;
}

const STORAGE_KEY = "unclick_community_tools";

export function getCommunityTools(): CommunityTool[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveCommunityTool(tool: CommunityTool): void {
  const existing = getCommunityTools();
  const updated = [...existing.filter((t) => t.id !== tool.id), tool];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export const TOOL_SUBMITTED_EVENT = "unclick:tool-submitted";
