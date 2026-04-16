/**
 * AdminKeychain - Keychain surface (/admin/keychain)
 *
 * BackstagePass with a face. Lists connected services from
 * platform_credentials + platform_connectors, shows status
 * indicators (active/expired), with placeholder reconnect/remove UI.
 */

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth";
import {
  KeyRound,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  ExternalLink,
  Shield,
} from "lucide-react";

interface Credential {
  id: string;
  platform: string;
  label: string;
  is_valid: boolean;
  last_tested_at: string | null;
  created_at: string;
  connector: {
    id: string;
    name: string;
    category: string;
    icon: string | null;
  } | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AdminKeychain() {
  const { session } = useSession();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/memory-admin?action=admin_credentials", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!cancelled && res.ok) {
          const body = await res.json();
          setCredentials(body.data ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [session]);

  // Group by category
  const grouped = credentials.reduce<Record<string, Credential[]>>((acc, cred) => {
    const cat = cred.connector?.category ?? "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cred);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Keychain</h1>
        <p className="mt-1 text-sm text-[#888]">
          Connected services and credentials
        </p>
      </div>

      {/* Encryption notice */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#E2B93B]/20 bg-[#E2B93B]/5 px-4 py-3">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#E2B93B]" />
        <div>
          <p className="text-xs font-medium text-[#E2B93B]">
            End-to-end encrypted
          </p>
          <p className="mt-0.5 text-[11px] text-[#888]">
            All credentials are encrypted with AES-256-GCM using a key derived
            from your API key. UnClick staff cannot decrypt them.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-[#666]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading credentials...</span>
        </div>
      ) : credentials.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-[#111111] p-8 text-center">
          <KeyRound className="mx-auto h-8 w-8 text-[#333]" />
          <p className="mt-3 text-sm text-[#666]">No credentials stored</p>
          <p className="mt-1 text-xs text-[#444]">
            Connect a platform via{" "}
            <a
              href="/backstagepass"
              className="text-[#E2B93B] underline-offset-2 hover:underline"
            >
              BackstagePass
            </a>{" "}
            or the MCP server to see it here
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, creds]) => (
            <div key={category}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#666]">
                {category}
              </h3>
              <div className="space-y-2">
                {creds.map((cred) => (
                  <div
                    key={cred.id}
                    className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#111111] p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-sm font-semibold text-[#888]">
                        {cred.connector?.icon ?? cred.platform.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {cred.connector?.name ?? cred.platform}
                        </p>
                        <p className="text-[11px] text-[#666]">
                          {cred.label} - added {timeAgo(cred.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Status badge */}
                      {cred.is_valid ? (
                        <span className="flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
                          <XCircle className="h-3 w-3" />
                          Expired
                        </span>
                      )}

                      {/* Action buttons (placeholder) */}
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          className="rounded-md p-1.5 text-[#666] transition-colors hover:bg-white/[0.04] hover:text-[#ccc]"
                          title="Reconnect (coming soon)"
                          onClick={() => {}}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="rounded-md p-1.5 text-[#666] transition-colors hover:bg-red-500/10 hover:text-red-400"
                          title="Remove (coming soon)"
                          onClick={() => {}}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Connect more link */}
      <div className="mt-8 text-center">
        <a
          href="/backstagepass"
          className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] px-4 py-2.5 text-sm text-[#888] transition-colors hover:border-[#E2B93B]/20 hover:text-[#E2B93B]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Connect a new service
        </a>
      </div>
    </div>
  );
}
