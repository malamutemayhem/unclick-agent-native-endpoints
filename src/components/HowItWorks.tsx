import FadeIn from "./FadeIn";
import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Connect UnClick to your AI",
    desc: "Add the UnClick MCP server to Claude Desktop, Cursor, or any MCP-compatible agent. Takes about 30 seconds. Or use a direct API key if you prefer.",
  },
  {
    number: "02",
    title: "Your AI can now use any tool",
    desc: "Once connected, your AI has access to all 26 tools in the marketplace. It can browse them, pick the right one, and call it directly. No extra setup per tool.",
  },
  {
    number: "03",
    title: "Just ask",
    desc: "Tell your AI to shorten a link, resize an image, generate a QR code, or hash some data. It handles the API call. You get the result. That is it.",
  },
];

const HowItWorks = () => (
  <section id="how-it-works" className="relative mx-auto max-w-3xl px-6 py-32">
    <FadeIn>
      <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
        How It Works
      </span>
    </FadeIn>
    <FadeIn delay={0.05}>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        Three steps. No jargon.
      </h2>
    </FadeIn>
    <FadeIn delay={0.1}>
      <p className="mt-3 text-body max-w-lg">
        You do not need to be a developer to use UnClick. If you can use Claude, ChatGPT, or OpenClaw, you can use this.
      </p>
    </FadeIn>

    <div className="mt-14 relative">
      {/* Vertical connector line */}
      <div className="absolute left-[23px] top-0 bottom-0 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent hidden sm:block" />

      <div className="space-y-12">
        {steps.map((step, i) => (
          <FadeIn key={step.number} delay={i * 0.15}>
            <motion.div
              className="flex gap-6 items-start group"
              whileHover={{ x: 4 }}
              transition={{ duration: 0.2 }}
            >
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full border border-primary/30 bg-card flex items-center justify-center font-mono text-sm text-primary group-hover:border-primary/60 group-hover:bg-primary/10 transition-all duration-300">
                  {step.number}
                </div>
                <div className="absolute inset-0 rounded-full bg-primary/10 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>

              <div className="pt-2">
                <h3 className="text-lg font-medium text-heading">{step.title}</h3>
                <p className="mt-1.5 text-sm text-body leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          </FadeIn>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
