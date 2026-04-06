import { useEffect, useState, useRef } from "react";
import { useInView } from "framer-motion";
import FadeIn from "./FadeIn";

const stats = [
  { value: 2.4, suffix: "M+", label: "API calls last month" },
  { value: 38, suffix: "ms", label: "Avg response time" },
  { value: 99.98, suffix: "%", label: "Uptime SLA" },
  { value: 7, suffix: "", label: "Agent-native tools" },
];

const AnimatedNumber = ({ value, suffix, duration = 2000 }: { value: number; suffix: string; duration?: number }) => {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(eased * value);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value, duration]);

  const formatted = value % 1 !== 0 ? display.toFixed(value < 10 ? 1 : 2) : Math.round(display).toString();

  return (
    <span ref={ref} className="tabular-nums">
      {formatted}{suffix}
    </span>
  );
};

const Stats = () => (
  <section className="relative border-y border-border/50 py-20 overflow-hidden">
    {/* Background glow */}
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] bg-primary/[0.03] blur-[100px]" />
    </div>

    <div className="relative z-10 mx-auto max-w-4xl px-6">
      <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
        {stats.map((stat, i) => (
          <FadeIn key={stat.label} delay={i * 0.1}>
            <div className="text-center">
              <div className="text-3xl font-semibold text-heading sm:text-4xl">
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{stat.label}</div>
            </div>
          </FadeIn>
        ))}
      </div>
    </div>
  </section>
);

export default Stats;
