import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Loader2, Play } from "lucide-react";
import { useSession } from "@/lib/auth";
import { CATEGORY_BADGE } from "./testpass-ui";

interface PackCard { id: string; slug?: string; name: string; description: string; check_count: number; category: string; }
type Depth = "smoke" | "standard" | "deep";

const EXAMPLE_TARGET_URL = "https://unclick.world/api/mcp";

const PACK_USE_WHEN: Record<string, string> = {
  "testpass-core": "Use this when you want a baseline check that your MCP server speaks the protocol correctly.",
};

const DEPTH_OPTIONS: { value: Depth; label: string; detail: string; subtitle: string }[] = [
  { value: "smoke",    label: "Smoke",    detail: "1 pass, ~30s, fastest",                  subtitle: "Use when you want a quick sanity check." },
  { value: "standard", label: "Standard", detail: "2 passes, ~2min, recommended",           subtitle: "Use before every release." },
  { value: "deep",     label: "Deep",     detail: "3 passes + auto-fix retry, ~5min, most thorough", subtitle: "Use before a major launch or security review." },
];

export default function NewRunWizard() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = session?.access_token;
  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const [step, setStep] = useState(1);
  const [packs, setPacks] = useState<PackCard[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [selectedPackId, setSelectedPackId] = useState<string>(searchParams.get("pack_id") ?? "");
  const [targetUrl, setTargetUrl] = useState(EXAMPLE_TARGET_URL);
  const [depth, setDepth] = useState<Depth>("standard");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPacks = useCallback(async () => {
    if (!token) return;
    setLoadingPacks(true);
    try {
      const res = await fetch("/api/memory-admin?action=list_testpass_packs", { headers: authHeader });
      const body = await res.json().catch(() => ({}));
      if (res.ok) setPacks(body.packs ?? []);
    } finally { setLoadingPacks(false); }
  }, [token, authHeader]);

  useEffect(() => { void fetchPacks(); }, [fetchPacks]);
  useEffect(() => {
    const pre = searchParams.get("pack_id");
    if (pre) { setSelectedPackId(pre); setStep(2); }
  }, [searchParams]);

  async function handleRun() {
    if (!selectedPackId || !targetUrl) {
      setError("Enter your MCP server URL before running."); return;
    }
    setRunning(true); setError(null);
    try {
      const res = await fetch("/api/memory-admin?action=start_testpass_run", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ pack_id: selectedPackId, target: targetUrl, depth }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Run failed (${res.status})`);
      navigate(`/admin/testpass/runs/${body.run_id as string}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Run failed"); }
    finally { setRunning(false); }
  }

  const selectedPack = packs.find((p) => p.id === selectedPackId);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate("/admin/testpass")} className="flex items-center gap-1.5 text-sm text-[#888] hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-xl font-semibold text-white">New TestPass run</h1>
      </div>

      <div className="mb-8 flex items-center gap-2 text-xs text-[#666]">
        {["Pick pack", "Pick target", "Pick depth"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${step === i+1 ? "border-[#61C1C4] bg-[#61C1C4]/15 text-[#61C1C4]" : step > i+1 ? "border-[#61C1C4]/40 bg-[#61C1C4]/10 text-[#61C1C4]" : "border-white/[0.12] text-[#555]"}`}>{i + 1}</span>
            <span className={step === i + 1 ? "text-white" : ""}>{label}</span>
            {i < 2 && <ChevronRight className="h-3 w-3" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <p className="mb-4 text-sm text-[#888]">Choose a conformance pack. Each pack is a named set of checks.</p>
          {loadingPacks ? (
            <div className="flex items-center gap-2 text-[#888] py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading packs...</div>
          ) : packs.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-[#111] px-6 py-10 text-center">
              <p className="text-sm text-white">No packs yet.</p>
              <p className="mt-1 text-xs text-[#888]">
                Use the testpass-core starter, or create your own from YAML.
              </p>
              <button
                onClick={() => navigate("/admin/testpass/packs/new/edit")}
                className="mt-5 rounded-lg border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-4 py-2 text-sm text-[#61C1C4] hover:bg-[#61C1C4]/20"
              >
                Open pack editor
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {packs.map((p) => {
                const useWhen = (p.slug && PACK_USE_WHEN[p.slug])
                  ?? p.description
                  ?? "Use this when you need a custom set of MCP checks.";
                return (
                  <button key={p.id} onClick={() => { setSelectedPackId(p.id); setStep(2); }}
                    className={`rounded-xl border p-4 text-left transition-colors ${selectedPackId === p.id ? "border-[#61C1C4]/50 bg-[#61C1C4]/10" : "border-white/[0.06] bg-[#111] hover:border-white/[0.12]"}`}>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-white">{p.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE[p.category] ?? CATEGORY_BADGE.general}`}>{p.category}</span>
                    </div>
                    <p className="text-xs text-[#888] line-clamp-2">{useWhen}</p>
                    <p className="mt-2 text-[11px] text-[#666]">{p.check_count} {p.check_count === 1 ? "check" : "checks"}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="mb-1 text-sm text-[#888]">
            Enter the URL of the MCP server you want to test.
            {selectedPack && <span className="text-white ml-1">Pack: {selectedPack.name}</span>}
          </p>
          <p className="mb-4 text-xs text-[#666]">
            Use this when you want to verify a staging deployment, check a new integration, or confirm conformance before release.
          </p>
          <label className="block text-xs font-medium text-[#ccc] mb-2">MCP server URL</label>
          <input type="url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm text-white focus:border-[#61C1C4]/40 focus:outline-none"
            placeholder={EXAMPLE_TARGET_URL} />
          <p className="mt-2 text-xs text-[#666]">
            Pre-filled with the unclick.world MCP as an example. Replace it with your own server URL. The URL should respond to JSON-RPC 2.0 requests.
          </p>
          {targetUrl === EXAMPLE_TARGET_URL && (
            <p className="mt-2 text-xs text-[#E2B93B]">
              Heads up: this is the example URL. Wipe it and paste your own server URL before running.
            </p>
          )}
          <div className="mt-6 flex gap-2">
            <button onClick={() => setStep(1)} className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-[#888] hover:text-white">Back</button>
            <button onClick={() => setStep(3)} disabled={!targetUrl}
              className="flex-1 rounded-lg border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-4 py-2 text-sm font-medium text-[#61C1C4] hover:bg-[#61C1C4]/20 disabled:opacity-50">
              Next: Pick depth
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <p className="mb-4 text-sm text-[#888]">How thorough should the run be?</p>
          <div className="grid gap-3">
            {DEPTH_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setDepth(opt.value)}
                className={`rounded-xl border p-4 text-left transition-colors ${depth === opt.value ? "border-[#61C1C4]/50 bg-[#61C1C4]/10" : "border-white/[0.06] bg-[#111] hover:border-white/[0.12]"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{opt.label}</span>
                  <span className="text-xs text-[#666]">{opt.detail}</span>
                </div>
                <p className="mt-1 text-xs text-[#888]">{opt.subtitle}</p>
              </button>
            ))}
          </div>
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          <div className="mt-6 flex gap-2">
            <button onClick={() => setStep(2)} className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-[#888] hover:text-white">Back</button>
            <button onClick={() => void handleRun()} disabled={running}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-[#E2B93B]/30 bg-[#E2B93B]/10 px-4 py-2 text-sm font-semibold text-[#E2B93B] hover:bg-[#E2B93B]/20 disabled:opacity-50">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? "Starting run..." : "Run TestPass"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
