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
    title: "UnClick - Agent rails for tools, memory, and QC",
    description: "One npm install gives your AI agent callable tools, persistent memory, secure connections, and Pass family QA checks.",
    ogTitle: "UnClick - Agent rails for tools, memory, and QC",
    ogDescription: "Tools, memory, connections, crews, and Pass family checks for AI agents.",
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
