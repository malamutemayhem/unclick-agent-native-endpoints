/**
 * Memory Admin - placeholder page
 *
 * This page will become the visual admin dashboard for UnClick Memory.
 * It connects to /api/memory-admin to read/write all 6 memory layers.
 *
 * API actions available (GET unless noted):
 *   ?action=status             - layer counts + decay tier breakdown
 *   ?action=business_context   - all business context entries
 *   ?action=sessions&limit=20  - recent session summaries
 *   ?action=facts&query=x&show_all=true - extracted facts (search + filter)
 *   ?action=library            - knowledge library index
 *   ?action=library_doc&slug=x - full document by slug
 *   ?action=conversations      - session list with message counts
 *   ?action=conversations&session_id=x - messages for a session
 *   ?action=code&session_id=x  - code dumps (optional session filter)
 *   ?action=search&query=x     - full-text search across conversation logs
 *   ?action=delete_fact        - POST: archive a fact (fact_id in body)
 *   ?action=delete_session     - POST: delete a session summary (session_id in body)
 *   ?action=update_business_context - POST: upsert business context (category, key, value in body)
 *
 * Tabs planned for the full UI:
 *   1. Overview   - counts per layer, decay chart, quick stats
 *   2. Context    - business context entries (Layer 1), add/edit
 *   3. Library    - knowledge library docs (Layer 2), view/edit
 *   4. Sessions   - session summaries (Layer 3), browse/search
 *   5. Facts      - extracted facts (Layer 4), search/archive/supersede
 *   6. Logs       - conversation log (Layer 5), browse by session
 *   7. Code       - code dumps (Layer 6), browse/search
 *   8. Search     - full-text search across everything
 */

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Brain } from "lucide-react";

export default function MemoryAdminPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pb-32 pt-28">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Memory Admin</h1>
            <p className="text-sm text-body">View and manage your agent's persistent memory</p>
          </div>
        </div>

        <div className="rounded-xl border border-border/40 bg-card/20 p-8">
          <p className="text-sm text-body">
            Dashboard UI coming soon. The API plumbing is ready at{" "}
            <code className="rounded bg-muted/20 px-1.5 py-0.5 font-mono text-xs text-primary">
              /api/memory-admin
            </code>
          </p>
          <div className="mt-6 rounded-lg border border-dashed border-border/50 bg-muted/5 p-6 text-center">
            <span className="font-mono text-xs text-muted-foreground">
              Awaiting design brief
            </span>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
