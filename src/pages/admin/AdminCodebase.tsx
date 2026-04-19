import { useEffect, useMemo, useState } from "react";
import { Code, Pencil, Sparkles, Check, Copy } from "lucide-react";
import { generateContextFile } from "@/lib/context-file-generator";

interface RepoItem { id: string; category: string; key: string; value: unknown; }

const REPO_KEYS = [
  { key: "stack", label: "Stack", placeholder: "e.g. React + TypeScript, Vercel, Supabase" },
  { key: "deploy_branch", label: "Deploy Branch", placeholder: "e.g. main or claude/deploy-branch" },
  { key: "deploy_process", label: "Deploy Process", placeholder: "e.g. Push to branch, Vercel auto-deploys" },
  { key: "file_structure", label: "File Structure", placeholder: "e.g. src/pages, src/components, api/" },
  { key: "constraints", label: "Constraints", placeholder: "e.g. 12 file limit in api/, no new routes" },
  { key: "gotchas", label: "Gotchas", placeholder: "e.g. JSONB handling, TEXT not UUID for IDs" },
  { key: "conventions", label: "Conventions", placeholder: "e.g. mc_ prefix for memory tables" },
  { key: "testing", label: "Testing", placeholder: "e.g. No test suite yet, manual QA only" },
];

type AgentType = "claude-code" | "cursor" | "aider";
const AGENT_LABELS: Record<AgentType, string> = { "claude-code": "Claude Code", cursor: "Cursor", aider: "Aider" };

function displayValue(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  return JSON.stringify(v, null, 2);
}

export default function AdminCodebase() {
  const apiKey = useMemo(() => localStorage.getItem("unclick_api_key") ?? "", []);
  const [repoItems, setRepoItems] = useState<RepoItem[]>([]);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [generated, setGenerated] = useState<{ content: string; filename: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadItems = () => {
    if (!apiKey) return;
    fetch("/api/memory-admin?action=business_context", { headers: { Authorization: `Bearer ${apiKey}` } })
      .then((r) => r.json())
      .then((body) => {
        const rows = (body.data ?? []).filter((r: RepoItem) => r.category === "repository");
        setRepoItems(rows);
      });
  };

  useEffect(loadItems, [apiKey]);

  const valueFor = (k: string) => {
    const row = repoItems.find((r) => r.key === k);
    return row ? displayValue(row.value) : "";
  };

  const saveEdit = async (keyName: string) => {
    await fetch("/api/memory-admin?action=set_business_context", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ category: "repository", key: keyName, value: draft }),
    });
    setEditKey(null);
    setDraft("");
    loadItems();
  };

  const handleGenerate = (agent: AgentType) => {
    const result = generateContextFile({
      agent,
      apiKeyPrefix: apiKey.slice(0, 8) + "...",
      mcpUrl: `https://unclick.world/api/mcp?key=${apiKey}`,
      repoContext: Object.fromEntries(repoItems.map((r) => [r.key, displayValue(r.value)])),
    });
    setGenerated(result);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!generated) return;
    await navigator.clipboard.writeText(generated.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!apiKey) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-8 text-center">
        <p className="text-sm text-white/70">No API key found for this session.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
          <Code className="h-5 w-5 text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Codebase</h1>
          <p className="text-sm text-white/50">What your AI knows about your code</p>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-[#61C1C4]/30 bg-[#61C1C4]/[0.06] p-4">
        <p className="text-sm text-[#61C1C4]/90">
          This loads at session start so your AI already knows your tech stack, deploy process,
          and common gotchas -- no need to re-explain every time.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {REPO_KEYS.map(({ key, label, placeholder }) => {
          const current = valueFor(key);
          const isEditing = editKey === key;
          return (
            <div key={key} className="rounded-xl border border-white/[0.06] bg-[#111] p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">{label}</h3>
                {!isEditing && (
                  <button onClick={() => { setEditKey(key); setDraft(current); }} className="rounded p-1 text-white/30 hover:bg-white/[0.06] hover:text-white">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    placeholder={placeholder}
                    className="w-full rounded-md border border-white/[0.06] bg-[#0A0A0A] px-3 py-2 font-mono text-xs text-white placeholder:text-white/30 focus:border-[#61C1C4]/50 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(key)} className="rounded-md bg-[#61C1C4] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90">Save</button>
                    <button onClick={() => { setEditKey(null); setDraft(""); }} className="rounded-md border border-white/[0.06] px-3 py-1.5 text-xs text-white/50 hover:text-white">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className={`whitespace-pre-wrap text-xs ${current ? "text-white/70" : "text-white/30"}`}>
                  {current || "Not set"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="my-8 border-t border-white/[0.06]" />

      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#E2B93B]" />
        <h2 className="text-lg font-semibold text-white">Generate CLAUDE.md</h2>
      </div>
      <p className="mb-4 text-sm text-white/60">
        Auto-generate a context file for your AI agent, pre-filled with your codebase info.
      </p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(AGENT_LABELS) as AgentType[]).map((agent) => (
          <button
            key={agent}
            onClick={() => handleGenerate(agent)}
            className="rounded-md border border-white/[0.06] bg-[#111] px-4 py-2 text-sm text-white/80 hover:border-[#61C1C4]/40 hover:text-white"
          >
            {AGENT_LABELS[agent]}
          </button>
        ))}
      </div>

      {generated && (
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#111] p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded bg-white/[0.06] px-2 py-1 font-mono text-xs text-[#61C1C4]">{generated.filename}</span>
            <button onClick={handleCopy} className="flex items-center gap-1 rounded-md border border-white/[0.06] px-3 py-1.5 text-xs text-white/70 hover:border-[#61C1C4]/40 hover:text-white">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-md bg-[#0A0A0A] p-3 font-mono text-xs text-white/80">{generated.content}</pre>
        </div>
      )}
    </>
  );
}
