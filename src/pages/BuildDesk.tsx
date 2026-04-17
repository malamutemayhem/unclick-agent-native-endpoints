/**
 * Build Desk - admin scaffold
 *
 * Plan, decompose, and dispatch structured coding work to AI workers
 * (Claude Code, Codex CLI, Cursor, custom MCP workers). Tracks task
 * dispatch history and results.
 *
 * Tabs:
 *   1. Tasks   - structured work items with acceptance criteria
 *   2. Workers - registered AI coding backends
 *   3. History - dispatch log, status, and results
 */

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hammer, ListChecks, Bot, History } from "lucide-react";

function BuildTasksTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/40 bg-card/20 p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-heading">
          <ListChecks className="h-4 w-4 text-primary" />
          Build Tasks
        </h2>
        <p className="mt-3 text-xs text-body leading-relaxed">
          Build Tasks are structured work items you can plan, decompose, and dispatch to AI coding
          workers. Create tasks with acceptance criteria, assign them to workers like Claude Code
          or Codex, and track progress here.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-border/50 bg-muted/5 p-12 text-center">
        <span className="font-mono text-xs text-muted-foreground">No build tasks yet</span>
      </div>
    </div>
  );
}

function BuildWorkersTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/40 bg-card/20 p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-heading">
          <Bot className="h-4 w-4 text-primary" />
          Workers
        </h2>
        <p className="mt-3 text-xs text-body leading-relaxed">
          Workers are AI coding backends that execute your build tasks. Register Claude Code, Codex
          CLI, Cursor, or custom MCP workers here. UnClick dispatches tasks to the right worker and
          brings results back.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-border/50 bg-muted/5 p-12 text-center">
        <span className="font-mono text-xs text-muted-foreground">No workers registered</span>
      </div>
    </div>
  );
}

function BuildHistoryTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/40 bg-card/20 p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-heading">
          <History className="h-4 w-4 text-primary" />
          Build History
        </h2>
        <p className="mt-3 text-xs text-body leading-relaxed">
          Build History shows every task dispatch, its status, and results. Use this to track what
          your AI workers have done and review their output.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-border/50 bg-muted/5 p-12 text-center">
        <span className="font-mono text-xs text-muted-foreground">No dispatch history</span>
      </div>
    </div>
  );
}

export default function BuildDeskPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pb-32 pt-28">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Hammer className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Build Desk</h1>
            <p className="text-sm text-body">
              Plan, dispatch, and track coding work across your AI workers
            </p>
          </div>
        </div>

        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="workers">Workers</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            <BuildTasksTab />
          </TabsContent>
          <TabsContent value="workers">
            <BuildWorkersTab />
          </TabsContent>
          <TabsContent value="history">
            <BuildHistoryTab />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
