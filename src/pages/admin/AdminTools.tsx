/**
 * Admin Tools - unified tool control panel
 *
 * Three sections:
 * 1. Your UnClick Tools (memory + utility tools)
 * 2. Connected Services (platform connectors)
 * 3. Marketplace (placeholder)
 *
 * Route: /memory/tools
 */

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Wrench, Rocket } from "lucide-react";
import UnClickTools from "./tools/UnClickTools";
import ConnectedServices from "./tools/ConnectedServices";

export default function AdminToolsPage() {
  const apiKey = localStorage.getItem("unclick_api_key") ?? "";

  if (!apiKey) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-6xl px-6 pb-32 pt-28">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-8 text-center">
            <p className="text-sm text-[#AAAAAA]">
              Set your API key in{" "}
              <a href="/settings" className="text-[#61C1C4] underline cursor-pointer transition-colors duration-150 hover:text-[#61C1C4]/80">
                Settings
              </a>{" "}
              to access the tools dashboard.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pb-32 pt-28">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#61C1C4]/10 text-[#61C1C4]">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-white">Tools</h1>
            <p className="text-sm text-[#AAAAAA]">Every tool your agent can use through UnClick</p>
          </div>
        </div>

        <div className="space-y-10">
          {/* Section 1: Your UnClick Tools */}
          <UnClickTools apiKey={apiKey} />

          {/* Section 2: Connected Services */}
          <ConnectedServices apiKey={apiKey} />

          {/* Section 3: Marketplace (placeholder) */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="flex items-center gap-2 font-mono text-lg font-semibold text-white">
                <Rocket className="h-5 w-5 text-[#61C1C4]" />
                Marketplace
              </h2>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[#61C1C4]">
                  <Rocket className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Community tools and custom integrations</p>
                  <p className="mt-1 text-xs text-[#AAAAAA]">
                    Build your own MCP tools or install from the UnClick marketplace. Coming soon.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
