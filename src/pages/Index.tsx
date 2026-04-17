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

const Index = () => {
  useCanonical("/");

  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Problem />
      <InstallSection />
      <Stats />
      <TrustSignals />
      <FinalCTA />
      <FAQ />
      <Footer />
    </div>
  );
};

export default Index;
