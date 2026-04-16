import { useEffect, useState } from "react";
import { Wrench, Rocket } from "lucide-react";
import { useSession } from "@/lib/auth";
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
          <UnClickTools metering={metering} />
        </section>

        {/* Section 2 - Connected Services */}
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-white">Connected Services</h2>
          <ConnectedServices connectors={connectors} loading={loading} />
        </section>

        {/* Section 3 - Marketplace placeholder */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Marketplace</h2>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-8 text-center">
            <Rocket className="mx-auto h-8 w-8 text-white/20 mb-3" />
            <p className="text-sm text-white/50">
              Community tools and custom integrations - coming soon.
            </p>
            <p className="mt-1 text-xs text-white/30">
              Build your own MCP tools or install from the UnClick marketplace.
            </p>
          </div>
        </section>
    </>
  );
}
