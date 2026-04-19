import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import DocsPage from "./pages/Docs.tsx";
import LinkInBioPage from "./pages/tools/LinkInBio.tsx";
import SchedulingPage from "./pages/tools/Scheduling.tsx";
import SolvePage from "./pages/tools/Solve.tsx";
import ArenaHome from "./pages/arena/ArenaHome.tsx";
import ArenaProblem from "./pages/arena/ArenaProblem.tsx";
import ArenaLeaderboard from "./pages/arena/ArenaLeaderboard.tsx";
import ArenaSubmitProblem from "./pages/arena/ArenaSubmitProblem.tsx";
import FAQPage from "./pages/FAQPage.tsx";
import SettingsPage from "./pages/Settings.tsx";
import ConnectPage from "./pages/Connect.tsx";
import DevelopersPage from "./pages/Developers.tsx";
import DeveloperDocsPage from "./pages/DeveloperDocs.tsx";
import DeveloperSubmitPage from "./pages/DeveloperSubmit.tsx";
import VibeCodingPage from "./pages/VibeCoding.tsx";
import TermsPage from "./pages/Terms.tsx";
import PrivacyPage from "./pages/Privacy.tsx";
import BackstagePassPage from "./pages/BackstagePass.tsx";
import MemoryPage from "./pages/Memory.tsx";
import MemorySetupPage from "./pages/MemorySetup.tsx";
import MemoryConnectPage from "./pages/MemoryConnect.tsx";
import MemorySetupGuidePage from "./pages/MemorySetupGuide.tsx";
import PricingPage from "./pages/Pricing.tsx";
import OrganiserPage from "./pages/Organiser.tsx";
import DispatchPage from "./pages/Dispatch.tsx";
import CrewsPage from "./pages/Crews.tsx";
import ToolsPage from "./pages/Tools.tsx";
import NewToAIPage from "./pages/NewToAI.tsx";
import SmartHomePage from "./pages/SmartHome.tsx";
import InstallRecoverPage from "./pages/InstallRecover.tsx";
import LoginPage from "./pages/Login.tsx";
import SignupPage from "./pages/Signup.tsx";
import AuthCallbackPage from "./pages/AuthCallback.tsx";
import RequireAuth from "./components/RequireAuth.tsx";
import AdminShell from "./pages/admin/AdminShell.tsx";
import AdminAccount from "./pages/admin/AdminAccount.tsx";
import AdminKnowledge from "./pages/admin/AdminKnowledge.tsx";
import AdminSessions from "./pages/admin/AdminSessions.tsx";
import AdminIdentity from "./pages/admin/AdminIdentity.tsx";
import AdminTimeline from "./pages/admin/AdminTimeline.tsx";
import AdminKeychain from "./pages/admin/AdminKeychain.tsx";
import AdminTools from "./pages/admin/AdminTools.tsx";
import AdminSettings from "./pages/admin/AdminSettings.tsx";
import AdminAgentsPage from "./pages/admin/AdminAgents.tsx";
import BuildDeskPage from "./pages/BuildDesk.tsx";

const queryClient = new QueryClient();

// Placeholders for pages Brief B will replace with real implementations.
function BrainMapPlaceholder() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Brain Map</h1>
      <p className="mt-1 text-sm text-[#888]">How your AI thinks</p>
      <div className="mt-8 rounded-xl border border-white/[0.06] bg-[#111] p-8 text-center">
        <p className="text-sm text-[#666]">Visual memory flow -- coming soon</p>
      </div>
    </div>
  );
}

function CodebasePlaceholder() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Codebase</h1>
      <p className="mt-1 text-sm text-[#888]">What your AI knows about your code</p>
      <div className="mt-8 rounded-xl border border-white/[0.06] bg-[#111] p-8 text-center">
        <p className="text-sm text-[#666]">Repository context cards -- coming soon</p>
      </div>
    </div>
  );
}

function ProjectsPlaceholder() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Projects</h1>
      <p className="mt-1 text-sm text-[#888]">Active workspaces your AI tracks</p>
      <div className="mt-8 rounded-xl border border-white/[0.06] bg-[#111] p-8 text-center">
        <p className="text-sm text-[#666]">Project memory -- coming soon</p>
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Analytics />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/tools/link-in-bio" element={<LinkInBioPage />} />
          <Route path="/tools/scheduling" element={<SchedulingPage />} />
          <Route path="/tools/solve" element={<SolvePage />} />
          {/* Arena - AI agent problem board with 6 viral features */}
          <Route path="/arena" element={<ArenaHome />} />
          <Route path="/arena/leaderboard" element={<ArenaLeaderboard />} />
          <Route path="/arena/submit" element={<ArenaSubmitProblem />} />
          <Route path="/arena/:id" element={<ArenaProblem />} />
          <Route path="/developers" element={<DevelopersPage />} />
          <Route path="/developers/docs" element={<DeveloperDocsPage />} />
          <Route path="/developers/submit" element={<DeveloperSubmitPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* Platform connector flow: /connect/:platform handles both connect + OAuth callback */}
          <Route path="/connect/:platform" element={<ConnectPage />} />
          <Route path="/developers/vibe-coding" element={<VibeCodingPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/backstagepass" element={<BackstagePassPage />} />
          {/* Core product pages */}
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/memory" element={<MemoryPage />} />
          {/* /memory/admin redirects to the new admin shell */}
          <Route path="/memory/admin" element={<Navigate to="/admin/memory/map" replace />} />
          <Route path="/memory/setup" element={<MemorySetupPage />} />
          <Route path="/memory/connect" element={<MemoryConnectPage />} />
          <Route path="/memory/setup-guide" element={<MemorySetupGuidePage />} />
          {/* Alias under /admin/ for forward compat with the admin shell */}
          <Route path="/admin/setup-guide" element={<MemorySetupGuidePage />} />
          {/* Phase 3: Admin shell with five surfaces */}
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminShell />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/admin/account" replace />} />
            <Route path="account" element={<AdminAccount />} />
            <Route path="memory/map" element={<BrainMapPlaceholder />} />
            <Route path="memory/knowledge" element={<AdminKnowledge />} />
            <Route path="memory/sessions" element={<AdminSessions />} />
            <Route path="memory/identity" element={<AdminIdentity />} />
            <Route path="memory/projects" element={<ProjectsPlaceholder />} />
            <Route path="memory/codebase" element={<CodebasePlaceholder />} />
            <Route path="memory/timeline" element={<AdminTimeline />} />
            <Route path="keychain" element={<AdminKeychain />} />
            <Route path="tools" element={<AdminTools />} />
            <Route path="settings" element={<AdminSettings />} />
            {/* Backward-compat redirects */}
            <Route path="you" element={<Navigate to="/admin/account" replace />} />
            <Route path="memory" element={<Navigate to="/admin/memory/map" replace />} />
            <Route path="activity" element={<Navigate to="/admin/memory/timeline" replace />} />
            <Route path="projects" element={<Navigate to="/admin/memory/projects" replace />} />
          </Route>
          {/* AdminAgents ships its own shell wrapper, so register it at the top level */}
          <Route path="/admin/agents" element={<AdminAgentsPage />} />
          {/* Phase 2 auth surface */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/organiser" element={<OrganiserPage />} />
          <Route path="/dispatch" element={<DispatchPage />} />
          <Route path="/crews" element={<CrewsPage />} />
          <Route path="/build" element={<BuildDeskPage />} />
          <Route path="/new-to-ai" element={<NewToAIPage />} />
          <Route path="/smarthome" element={<SmartHomePage />} />
          <Route path="/pricing" element={<PricingPage />} />
          {/* Install ticket recovery: fresh 24h code for returning users */}
          <Route path="/i" element={<InstallRecoverPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
