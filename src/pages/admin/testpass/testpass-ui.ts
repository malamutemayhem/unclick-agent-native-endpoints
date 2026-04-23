export const STATUS_PILL: Record<string, string> = {
  running:         "bg-blue-500/15 text-blue-300 border-blue-500/30",
  complete:        "bg-[#61C1C4]/15 text-[#61C1C4] border-[#61C1C4]/30",
  failed:          "bg-red-500/15 text-red-400 border-red-500/30",
  budget_exceeded: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  pending:         "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

export const STATUS_LABEL: Record<string, string> = {
  running: "Running", complete: "Complete", failed: "Failed",
  budget_exceeded: "Failed", pending: "Pending",
};

export const VERDICT_ICON: Record<string, string> = {
  check: "✅", fail: "❌", na: "⏭️", other: "❓", pending: "⏳",
};

export const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-600/10 text-red-400 border-red-600/30",
  high:     "bg-orange-500/10 text-orange-400 border-orange-500/30",
  medium:   "bg-[#E2B93B]/10 text-[#E2B93B] border-[#E2B93B]/30",
  low:      "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

export const CATEGORY_BADGE: Record<string, string> = {
  "json-rpc": "bg-purple-500/15 text-purple-300",
  "mcp":      "bg-[#61C1C4]/15 text-[#61C1C4]",
  "general":  "bg-gray-500/15 text-gray-300",
};

export function fmtDate(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

export function elapsedLabel(startIso: string, endIso?: string) {
  const secs = Math.round((Date.now() - new Date(startIso).getTime()) / 1000);
  const end = endIso ? Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000) : secs;
  return end < 60 ? `${end}s` : `${Math.floor(end / 60)}m ${end % 60}s`;
}
