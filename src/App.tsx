import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import MemoryAdminPage from "./pages/MemoryAdmin.tsx";
import MemorySetupPage from "./pages/MemorySetup.tsx";
import PricingPage from "./pages/Pricing.tsx";
import OrganiserPage from "./pages/Organiser.tsx";
import DispatchPage from "./pages/Dispatch.tsx";
import CrewsPage from "./pages/Crews.tsx";
import ToolsPage from "./pages/Tools.tsx";
import NewToAIPage from "./pages/NewToAI.tsx";
import SmartHomePage from "./pages/SmartHome.tsx";
import InstallRecoverPage from "./pages/InstallRecover.tsx";

const queryClient = new QueryClient();

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
          <Route path="/memory/admin" element={<MemoryAdminPage />} />
          <Route path="/memory/setup" element={<MemorySetupPage />} />
          <Route path="/organiser" element={<OrganiserPage />} />
          <Route path="/dispatch" element={<DispatchPage />} />
          <Route path="/crews" element={<CrewsPage />} />
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
