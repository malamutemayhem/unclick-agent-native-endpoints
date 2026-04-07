import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import { useCanonical } from "@/hooks/use-canonical";

const FAQPage = () => {
  useCanonical("/faq");
  useEffect(() => {
    document.title = "FAQ — UnClick AI Agent Marketplace";
    return () => { document.title = "UnClick — The App Store for AI Agents"; };
  }, []);
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-14">
        <FAQ />
      </div>
      <Footer />
    </div>
  );
};

export default FAQPage;
