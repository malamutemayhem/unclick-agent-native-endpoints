import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Strip from "@/components/Strip";
import Problem from "@/components/Problem";
import Tools from "@/components/Tools";
import CodeBlock from "@/components/CodeBlock";
import Pricing from "@/components/Pricing";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="film-grain min-h-screen">
    <Navbar />
    <Hero />
    <Strip />
    <Problem />
    <Tools />
    <CodeBlock />
    <Pricing />
    <FinalCTA />
    <Footer />
  </div>
);

export default Index;
