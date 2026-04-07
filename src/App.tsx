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
import FAQPage from "./pages/FAQPage.tsx";

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
          <Route path="/arena/:id" element={<ArenaProblem />} />
          <Route path="/faq" element={<FAQPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
