import { useState } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Tools from "@/components/Tools";
import HowItWorks from "@/components/HowItWorks";
import InstallSection from "@/components/InstallSection";
import ForDevelopers from "@/components/ForDevelopers";
import Footer from "@/components/Footer";

const Index = () => {
  const [search, setSearch] = useState("");

  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero search={search} onSearch={setSearch} />
      <Tools searchQuery={search} />
      <HowItWorks />
      <InstallSection />
      <ForDevelopers />
      <Footer />
    </div>
  );
};

export default Index;
