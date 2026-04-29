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
import VerifyMfaPage from "./pages/VerifyMfa.tsx";
import RequireAuth from "./components/RequireAuth.tsx";
import RequireAdmin from "./components/RequireAdmin.tsx";
import BetaBanner from "./components/BetaBanner.tsx";
import AdminShell from "./pages/admin/AdminShell.tsx";
import AdminYou from "./pages/admin/AdminYou.tsx";
import AdminMemory from "./pages/admin/AdminMemory.tsx";
import AdminKeychain from "./pages/admin/AdminKeychain.tsx";
import AdminTools from "./pages/admin/AdminTools.tsx";
import AdminActivity from "./pages/admin/AdminActivity.tsx";
import AdminSettings from "./pages/admin/AdminSettings.tsx";
import AdminAgentsPage from "./pages/admin/AdminAgents.tsx";
import AdminAnalytics from "./pages/admin/AdminAnalytics.tsx";
import AdminCodebase from "./pages/admin/AdminCodebase.tsx";
import AdminOrchestratorPage from "./pages/admin/AdminOrchestrator.tsx";
import AdminTestPass from "./pages/admin/AdminTestPass.tsx";
import TestPassCatalog from "./pages/admin/testpass/TestPassCatalog.tsx";
import NewRunWizard from "./pages/admin/testpass/NewRunWizard.tsx";
import RunDetail from "./pages/admin/testpass/RunDetail.tsx";
import ReportDetail from "./pages/admin/testpass/ReportDetail.tsx";
import CrewsCatalog from "./pages/admin/crews/CrewsCatalog.tsx";
import CrewComposer from "./pages/admin/crews/CrewComposer.tsx";
import CrewsRuns from "./pages/admin/crews/CrewsRuns.tsx";
import CrewsSettings from "./pages/admin/crews/CrewsSettings.tsx";
import CrewRun from "./pages/admin/crews/CrewRun.tsx";
import AdminUsers from "./pages/admin/AdminUsers.tsx";
import AdminSystemHealth from "./pages/admin/AdminSystemHealth.tsx";
import AdminModeration from "./pages/admin/AdminModeration.tsx";
import AdminAuditLog from "./pages/admin/AdminAuditLog.tsx";
import SignalsCatalog from "./pages/admin/signals/SignalsCatalog.tsx";
import SignalsSettings from "./pages/admin/signals/SignalsSettings.tsx";
import Fishbowl from "./pages/admin/Fishbowl.tsx";
import BuildDeskPage from "./pages/BuildDesk.tsx";
import { initPostHog } from "./lib/posthog.ts";

initPostHog();

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Analytics />
      <BrowserRouter>
        <BetaBanner />
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
          {/* Legacy /settings redirects into the admin shell */}
          <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
          {/* Platform connector flow: /connect/:platform handles both connect + OAuth callback */}
          <Route path="/connect/:platform" element={<ConnectPage />} />
          <Route path="/developers/vibe-coding" element={<VibeCodingPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/backstagepass" element={<Navigate to="/admin/keychain" replace />} />
          {/* Core product pages */}
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/memory" element={<MemoryPage />} />
          {/* /memory/admin redirects to the new admin shell */}
          <Route path="/memory/admin" element={<Navigate to="/admin/memory" replace />} />
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
            <Route index element={<Navigate to="/admin/you" replace />} />
            <Route path="you" element={<AdminYou />} />
            <Route path="memory" element={<AdminMemory />} />
            <Route path="keychain" element={<AdminKeychain />} />
            <Route path="tools" element={<AdminTools />} />
            <Route path="activity" element={<AdminActivity />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="agents"     element={<AdminAgentsPage />} />
            <Route path="testpass"              element={<TestPassCatalog />} />
            <Route path="testpass/new"          element={<NewRunWizard />} />
            <Route path="testpass/runs/:id"     element={<RunDetail />} />
            <Route path="testpass/packs/:id/edit" element={<AdminTestPass />} />
            <Route path="testpass/reports"      element={<Navigate to="/admin/testpass" replace />} />
            <Route path="testpass/reports/:id"  element={<ReportDetail />} />
            <Route path="crews"          element={<CrewsCatalog />} />
            <Route path="crews/new"      element={<CrewComposer />} />
            <Route path="crews/:id/edit" element={<CrewComposer />} />
            <Route path="crews/runs"          element={<CrewsRuns />} />
            <Route path="crews/runs/:runId"  element={<CrewRun />} />
            <Route path="crews/settings"      element={<CrewsSettings />} />
            {/* Admin-only surfaces (wrapped in RequireAdmin; also hidden from non-admin sidebar) */}
            <Route path="analytics"      element={<RequireAdmin><AdminAnalytics /></RequireAdmin>} />
            <Route path="codebase"       element={<RequireAdmin><AdminCodebase /></RequireAdmin>} />
            <Route path="orchestrator"   element={<RequireAdmin><AdminOrchestratorPage /></RequireAdmin>} />
            <Route path="users"          element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
            <Route path="system-health"  element={<RequireAdmin><AdminSystemHealth /></RequireAdmin>} />
            <Route path="moderation"     element={<RequireAdmin><AdminModeration /></RequireAdmin>} />
            <Route path="audit-log"      element={<RequireAdmin><AdminAuditLog /></RequireAdmin>} />
            <Route path="signals"          element={<SignalsCatalog />} />
            <Route path="signals/settings" element={<SignalsSettings />} />
            <Route path="fishbowl"         element={<Fishbowl />} />
          </Route>
          {/* Phase 2 auth surface */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/auth/verify-mfa" element={<VerifyMfaPage />} />
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
