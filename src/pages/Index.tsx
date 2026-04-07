import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Strip from "@/components/Strip";
import Stats from "@/components/Stats";
import Problem from "@/components/Problem";
import HowItWorks from "@/components/HowItWorks";
import InstallSection from "@/components/InstallSection";
import Tools from "@/components/Tools";
import TrustSignals from "@/components/TrustSignals";
import ForDevelopers from "@/components/ForDevelopers";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen">
    <Navbar />
    <Hero />
    <Strip />
    <Stats />
    <Problem />
    <HowItWorks />
    <InstallSection />
    <Tools />
    <TrustSignals />
    <ForDevelopers />
    <FinalCTA />
    <Footer />
  </div>
);

export default Index;
