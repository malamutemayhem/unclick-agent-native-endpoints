import { Link } from "react-router-dom";
import { Plug, ExternalLink } from "lucide-react";

interface Connector {
  id: string;
  name: string;
  icon?: string;
  category?: string;
  auth_type?: "oauth2" | "api_key" | "bot_token";
  description?: string | null;
  setup_url?: string | null;
  test_endpoint?: string | null;
  credential: { is_valid: boolean; last_tested_at: string | null } | null;
}

interface ConnectedServicesProps {
  connectors: Connector[];
  loading: boolean;
}

export default function ConnectedServices({ connectors, loading }: ConnectedServicesProps) {
  function getSetupLabel(authType?: Connector["auth_type"]): string {
    switch (authType) {
      case "oauth2":
        return "OAuth setup";
      case "bot_token":
        return "Bot token";
      case "api_key":
      default:
        return "API key";
    }
  }

  function getStatus(connector: Connector): {
    dot: string;
    pillClass: string;
    pill: string;
    note: string;
  } {
    const credential = connector.credential;
    if (!credential) {
      return {
        dot: "bg-white/20",
        pillClass: "border border-white/[0.08] bg-white/[0.04] text-white/75",
        pill: "Setup required",
        note: "No saved connection yet.",
      };
    }

    if (!credential.is_valid) {
      return {
        dot: "bg-amber-400",
        pillClass: "bg-amber-400/10 text-amber-200",
        pill: "Needs reconnection",
        note: "Reconnect or retest this service in Connections.",
      };
    }

    if (!credential.last_tested_at) {
      return {
        dot: "bg-sky-400",
        pillClass: "bg-sky-400/10 text-sky-200",
        pill: "Setup incomplete",
        note: "Saved, but not validated with a connection test yet.",
      };
    }

    return {
      dot: "bg-green-500",
      pillClass: "bg-green-500/10 text-green-200",
      pill: "Connected",
      note: "Ready for approved agent workflows.",
    };
  }

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
          No connections yet. Add a service in Connections to enable these tools.
        </p>
        <Link
          to="/admin/keychain"
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#61C1C4] hover:text-[#61C1C4]/80 transition-colors"
        >
          Go to Connections
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {connectors.map((c) => {
        const status = getStatus(c);
        const setupLabel = getSetupLabel(c.auth_type);
        const hasTest = Boolean(c.test_endpoint);

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
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${status.pillClass}`}>
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.pill}
              </span>
              <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] text-white/45">
                {setupLabel}
              </span>
              {hasTest && (
                <span className="rounded-full border border-[#61C1C4]/20 bg-[#61C1C4]/10 px-2 py-0.5 text-[10px] text-[#61C1C4]">
                  Test supported
                </span>
              )}
            </div>
            <p className="mt-2 text-[11px] text-white/40">
              {status.note}
              {c.description ? ` ${c.description}` : ""}
            </p>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-[10px] text-white/30">
                {c.setup_url ? "Setup guide available" : "Managed in Connections"}
              </div>
              <Link
                to="/admin/keychain"
                className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
              >
                {c.credential ? "Manage" : "Set up"}
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
