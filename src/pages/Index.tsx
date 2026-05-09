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
    title: "UnClick - Agent rails for apps, memory, and proof",
    description: "One connection gives your AI agent apps, memory, Passport permissions, Autopilot orchestration, and XPass proof.",
    ogTitle: "UnClick - Agent rails for apps, memory, and proof",
    ogDescription: "Apps, memory, Passport, Autopilot, and XPass checks for AI agents.",
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
