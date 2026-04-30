import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Wrench, Rocket, PenSquare } from "lucide-react";
import { useSession } from "@/lib/auth";
import { InfoCard } from "./memory/InfoCard";
import UnClickTools from "./tools/UnClickTools";
import ConnectedServices from "./tools/ConnectedServices";

interface Connector {
  id: string;
  name: string;
  icon?: string;
  category?: string;
  credential: { is_valid: boolean; last_tested_at: string | null } | null;
}

export default function AdminToolsPage() {
  const [metering, setMetering] = useState<Record<string, { count: number }>>({});
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);

  const { session } = useSession();

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/memory-admin?action=admin_tools", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const body = await res.json();
          setMetering(body.metering ?? {});
          setConnectors(body.connectors ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [session]);

  if (!session) {
    return (
      <p className="text-sm text-white/50">
        Sign in to access Tools Admin.
      </p>
    );
  }

  return (
    <>
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#61C1C4]/10">
            <Wrench className="h-5 w-5 text-[#61C1C4]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Tools</h1>
            <p className="text-sm text-white/50">Everything your agent can use through UnClick</p>
          </div>
        </div>

        {/* Section 1 - Your UnClick Tools */}
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-white">Your UnClick Tools</h2>
          <InfoCard
            id="tools-how"
            title="How do these tools work?"
            description="When you connect UnClick to your AI agent, it gets all these tools automatically. Your agent chooses which ones to use based on what you ask."
            learnMore="Memory tools handle persistent context. Utility tools handle everyday tasks like formatting JSON, generating QR codes, converting timestamps. Your agent discovers and calls them as needed - no configuration required."
          />
          <UnClickTools metering={metering} />
        </section>

        {/* Section 2 - Connections */}
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-white">Connections</h2>
          <InfoCard
            id="tools-services"
            title="What are Connections?"
            description="Third-party platforms you have linked for your agents, like GitHub, Stripe, or Cloudflare."
            learnMore="Connections keeps setup state, health, and encrypted secrets in one place so your agents can use approved services without you pasting keys into every run."
          />
          <ConnectedServices connectors={connectors} loading={loading} />
        </section>

        {/* Section 3 - Marketplace */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Marketplace</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              to="/admin/copypass"
              className="rounded-xl border border-white/[0.06] bg-[#111] p-5 transition-colors hover:border-fuchsia-400/30 hover:bg-white/[0.04]"
            >
              <div className="flex items-center gap-2">
                <PenSquare className="h-4 w-4 text-fuchsia-300" />
                <h3 className="text-sm font-semibold text-white">CopyPass</h3>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-fuchsia-500/10 text-fuchsia-300">
                  Pass family
                </span>
              </div>
              <p className="mt-2 text-xs text-white/50">
                Scaffold-only MCP and admin surface for AI-generated copy review. Deterministic checks land in a later chunk.
              </p>
              <p className="mt-3 text-[11px] font-medium text-fuchsia-300">
                Open CopyPass →
              </p>
            </Link>

            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-8 text-center">
              <Rocket className="mx-auto h-8 w-8 text-white/20 mb-3" />
              <p className="text-sm text-white/50">
                Community tools and custom integrations - coming soon.
              </p>
              <p className="mt-1 text-xs text-white/30">
                Build your own MCP tools or install from the UnClick marketplace.
              </p>
            </div>
          </div>
        </section>
    </>
  );
}
