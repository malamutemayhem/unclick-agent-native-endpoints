import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Problem from "@/components/Problem";
import InstallSection from "@/components/InstallSection";
import Stats from "@/components/Stats";
import TrustSignals from "@/components/TrustSignals";
import FinalCTA from "@/components/FinalCTA";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import { useCanonical } from "@/hooks/use-canonical";
import { useMetaTags } from "@/hooks/useMetaTags";
import VantaWavesBackground from "@/components/VantaWavesBackground";

const Index = () => {
  useCanonical("/");
  useMetaTags({
    title: "UnClick - The Operating System for AI Agents",
    description: "One npm install gives your AI agent access to 450+ callable endpoints across 60+ integrations, plus persistent cross-session memory. The MCP marketplace.",
    ogTitle: "UnClick - The Operating System for AI Agents",
    ogDescription: "450+ tools. 60+ integrations. One npm install. Give your AI agent everything it needs.",
    ogUrl: "https://unclick.world/",
  });

  return (
    <VantaWavesBackground>
      <Navbar />
      <Hero />
      <Problem />
      <InstallSection />
      <Stats />
      <TrustSignals />
      <FinalCTA />
      <FAQ />
      <Footer />
    </VantaWavesBackground>
  );
};

export default Index;
