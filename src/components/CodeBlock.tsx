import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import FadeIn from "./FadeIn";

const lines = [
  { method: "POST", path: "/v1/schedule/events", status: "201 Created", time: "38ms" },
  { method: "POST", path: "/v1/links/pages", status: "201 Created", time: "41ms" },
  { method: "POST", path: "/v1/mail/send", status: "202 Accepted", time: "52ms" },
];

const TypewriterLine = ({ line, delay }: { line: typeof lines[0]; delay: number }) => {
  const full = `${line.method} ${line.path}`;
  const [chars, setChars] = useState(0);
  const [showResponse, setShowResponse] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const startTimeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setChars(i);
        if (i >= full.length) {
          clearInterval(interval);
          setTimeout(() => setShowResponse(true), 200);
        }
      }, 25);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(startTimeout);
  }, [inView, delay, full.length]);

  return (
    <div ref={ref} className="flex flex-wrap gap-x-4 py-1.5 font-mono text-sm">
      <span className="text-muted-custom">&gt;</span>
      <span className="text-heading">{full.slice(0, chars)}</span>
      {chars < full.length && (
        <span className="inline-block w-2 h-4 bg-primary animate-pulse" />
      )}
      {showResponse && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="ml-auto flex gap-2"
        >
          <span className="text-primary">→ {line.status}</span>
          <span className="text-muted-custom">({line.time})</span>
        </motion.span>
      )}
    </div>
  );
};

const CodeBlock = () => (
  <section className="mx-auto max-w-3xl px-6 py-32">
    <FadeIn>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <span className="ml-3 font-mono text-xs text-muted-custom">terminal</span>
        </div>
        <div className="p-6">
          {lines.map((line, i) => (
            <TypewriterLine key={i} line={line} delay={i * 1200} />
          ))}
        </div>
      </div>
    </FadeIn>
  </section>
);

export default CodeBlock;
