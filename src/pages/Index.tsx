import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Strip from "@/components/Strip";
import Stats from "@/components/Stats";
import Problem from "@/components/Problem";
import HowItWorks from "@/components/HowItWorks";
import Tools from "@/components/Tools";
import InstallSection from "@/components/InstallSection";
import ForDevelopers from "@/components/ForDevelopers";
import CodeBlock from "@/components/CodeBlock";
import TrustSignals from "@/components/TrustSignals";
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
    <Tools />
    <InstallSection />
    <ForDevelopers />
    <CodeBlock />
    <TrustSignals />
    <FinalCTA />
    <Footer />
  </div>
);

export default Index;
