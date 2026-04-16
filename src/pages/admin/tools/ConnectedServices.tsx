import { Link } from "react-router-dom";
import { Plug, ExternalLink } from "lucide-react";

interface Connector {
  id: string;
  name: string;
  icon?: string;
  category?: string;
  credential: { is_valid: boolean; last_tested_at: string | null } | null;
}

interface ConnectedServicesProps {
  connectors: Connector[];
  loading: boolean;
}

export default function ConnectedServices({ connectors, loading }: ConnectedServicesProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-white/[0.03] border border-white/[0.06]" />
        ))}
      </div>
    );
  }

  if (connectors.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-6 text-center">
        <Plug className="mx-auto h-8 w-8 text-white/20 mb-3" />
        <p className="text-sm text-white/50">
          Third-party service integrations - connect your API keys in Keychain to enable these tools.
        </p>
        <Link
          to="/settings"
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#61C1C4] hover:text-[#61C1C4]/80 transition-colors"
        >
          Go to Keychain
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {connectors.map((c) => {
        const connected = c.credential !== null;
        const valid = c.credential?.is_valid ?? false;

        let statusDot: string;
        let statusText: string;
        if (connected && valid) {
          statusDot = "bg-green-500";
          statusText = "Connected";
        } else if (connected && !valid) {
          statusDot = "bg-red-500";
          statusText = "Connection Error";
        } else {
          statusDot = "bg-white/20";
          statusText = "Not Connected";
        }

        return (
          <div key={c.id} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              {c.icon ? (
                <span className="text-2xl">{c.icon}</span>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-xs text-white/30">
                  {c.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{c.name}</p>
                {c.category && (
                  <span className="text-[10px] text-white/30">{c.category}</span>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${statusDot}`} />
                <span className="text-xs text-white/40">{statusText}</span>
              </div>
              <Link
                to="/settings"
                className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
              >
                Manage
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
