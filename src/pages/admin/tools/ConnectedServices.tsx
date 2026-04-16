import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plug, ArrowRight, Key } from "lucide-react";

interface Connector {
  id: string;
  name: string;
  icon?: string;
  category?: string;
  credential: {
    is_valid: boolean;
    last_tested_at: string | null;
  } | null;
}

interface ConnectedServicesProps {
  apiKey: string;
}

export default function ConnectedServices({ apiKey }: ConnectedServicesProps) {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/memory-admin?action=admin_tools", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) {
          const body = await res.json();
          setConnectors(body.connectors ?? []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return null;
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-mono text-lg font-semibold text-white">
          <Plug className="h-5 w-5 text-[#61C1C4]" />
          Connected Services
        </h2>
      </div>

      {connectors.length === 0 ? (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[#666666]">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-[#AAAAAA]">
                Third-party service integrations - connect your API keys in Keychain to enable these tools.
              </p>
              <Link
                to="/settings"
                className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[#61C1C4] transition-opacity duration-150 hover:opacity-80"
              >
                Go to Keychain
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {connectors.map((connector) => {
            const hasCredential = connector.credential !== null;
            const isValid = connector.credential?.is_valid === true;

            let statusDot = "bg-[#666666]";
            let statusLabel = "Not Connected";
            if (hasCredential && isValid) {
              statusDot = "bg-green-500";
              statusLabel = "Connected";
            } else if (hasCredential && !isValid) {
              statusDot = "bg-red-500";
              statusLabel = "Connection Error";
            }

            return (
              <div
                key={connector.id}
                className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 transition-colors duration-150 hover:border-white/[0.1]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-lg">
                  {connector.icon ?? "🔌"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{connector.name}</p>
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusDot}`} />
                    <span className="text-[10px] text-[#AAAAAA]">{statusLabel}</span>
                  </div>
                </div>
                <Link
                  to="/settings"
                  className="cursor-pointer rounded-md border border-white/[0.08] px-2.5 py-1 text-[10px] font-medium text-[#AAAAAA] transition-colors duration-150 hover:text-white"
                >
                  Manage
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
