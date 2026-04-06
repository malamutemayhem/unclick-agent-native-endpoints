import FadeIn from "./FadeIn";
import { motion } from "framer-motion";

const tools = [
  { name: "Links", replaces: "Linktree", endpoint: "/v1/links/*" },
  { name: "Schedule", replaces: "Calendly", endpoint: "/v1/schedule/*" },
  { name: "Forms", replaces: "Typeform", endpoint: "/v1/forms/*" },
  { name: "Mail", replaces: "Beehiiv", endpoint: "/v1/mail/*" },
  { name: "Post", replaces: "Buffer", endpoint: "/v1/post/*" },
  { name: "Sign", replaces: "DocuSign", endpoint: "/v1/sign/*" },
];

const Tools = () => (
  <section id="tools" className="relative mx-auto max-w-3xl px-6 py-32">
    <FadeIn>
      <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
        The Suite
      </span>
    </FadeIn>
    <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {tools.map((tool, i) => (
        <FadeIn key={tool.name} delay={i * 0.08}>
          <motion.div
            className="group glow-card relative flex flex-col rounded-lg border border-border/50 bg-card/50 px-5 py-5 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card overflow-hidden"
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
          >
            {/* Hover glow */}
            <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 bg-primary/0 group-hover:bg-primary/10 blur-[40px] rounded-full transition-all duration-500" />

            <div className="flex items-baseline justify-between">
              <span className="text-lg font-medium text-heading">{tool.name}</span>
              <span className="text-sm text-muted-foreground">replaces {tool.replaces}</span>
            </div>
            <span className="mt-2 font-mono text-xs text-primary/50 group-hover:text-primary/80 transition-colors">
              {tool.endpoint}
            </span>
          </motion.div>
        </FadeIn>
      ))}
    </div>
    <FadeIn delay={0.5}>
      <p className="mt-10 text-center text-sm text-muted-foreground">
        One auth system. One API pattern. All tools.
      </p>
    </FadeIn>
  </section>
);

export default Tools;
