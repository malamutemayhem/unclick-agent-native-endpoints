/**
 * AdminSearchBar - global command palette for the admin shell.
 *
 * Ctrl+K (or Cmd+K) focuses the input. Debounced search hits the
 * admin_search action, which returns hits from extracted facts, session
 * summaries, and business context. Arrow keys / Enter navigate the
 * dropdown, Esc closes it.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { Search, Brain, FileText, Zap, Loader2 } from "lucide-react";

const API_KEY_STORAGE = "unclick_api_key";

type SearchHit = {
  type: "fact" | "session" | "context";
  id: string;
  preview: string;
  created_at: string;
};

function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform ?? navigator.userAgent);
}

const TYPE_META: Record<SearchHit["type"], { label: string; icon: typeof Search }> = {
  fact: { label: "Fact", icon: Brain },
  session: { label: "Session", icon: FileText },
  context: { label: "Context", icon: Zap },
};

const TARGETS: Record<SearchHit["type"], string> = {
  fact: "/admin/memory?tab=facts",
  session: "/admin/memory?tab=sessions",
  context: "/admin/memory?tab=identity",
};

export default function AdminSearchBar() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const shortcutHint = useMemo(() => (isMac() ? "Cmd+K" : "Ctrl+K"), []);

  // Ctrl/Cmd+K to focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click outside closes dropdown
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  // Debounced fetch
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      const apiKey = localStorage.getItem(API_KEY_STORAGE) ?? "";
      if (!apiKey) {
        setResults([]);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/memory-admin?action=admin_search&query=${encodeURIComponent(q)}`,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        if (!res.ok) {
          setResults([]);
        } else {
          const body = (await res.json()) as { data?: SearchHit[] };
          setResults(Array.isArray(body.data) ? body.data : []);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setActiveIndex(0);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const pick = useCallback(
    (hit: SearchHit) => {
      setOpen(false);
      setQuery("");
      navigate(TARGETS[hit.type]);
    },
    [navigate]
  );

  function handleKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[activeIndex];
      if (hit) pick(hit);
    }
  }

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search facts, sessions, context..."
          className="w-full rounded-lg border border-white/[0.08] bg-[#111] px-9 py-2 text-sm text-[#ccc] placeholder:text-[#666] focus:border-[#61C1C4]/60 focus:outline-none focus:ring-1 focus:ring-[#61C1C4]/40"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-[#888]">
          {shortcutHint}
        </span>
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-lg border border-white/[0.08] bg-[#111] shadow-2xl">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-[#888]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching...
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-4 py-3 text-xs text-[#666]">No matches</div>
          )}
          {!loading && results.length > 0 && (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((hit, i) => {
                const meta = TYPE_META[hit.type];
                const Icon = meta.icon;
                const active = i === activeIndex;
                return (
                  <li key={`${hit.type}-${hit.id}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => pick(hit)}
                      className={`flex w-full items-start gap-3 px-4 py-2 text-left text-xs transition-colors ${
                        active ? "bg-[#61C1C4]/10 text-[#ccc]" : "text-[#bbb] hover:bg-white/[0.04]"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded ${
                          active ? "text-[#61C1C4]" : "text-[#888]"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="mb-0.5 block font-mono text-[10px] uppercase tracking-wide text-[#666]">
                          {meta.label}
                        </span>
                        <span className="block truncate">{hit.preview}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
