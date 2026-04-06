import FadeIn from "./FadeIn";

const tools = [
  { name: "Links", replaces: "Linktree" },
  { name: "Schedule", replaces: "Calendly" },
  { name: "Forms", replaces: "Typeform" },
  { name: "Mail", replaces: "Beehiiv" },
  { name: "Post", replaces: "Buffer" },
  { name: "Sign", replaces: "DocuSign" },
];

const Tools = () => (
  <section id="tools" className="mx-auto max-w-3xl px-6 py-32">
    <FadeIn>
      <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
        The Suite
      </span>
    </FadeIn>
    <FadeIn delay={0.1}>
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {tools.map((tool, i) => (
          <div
            key={tool.name}
            className="flex items-baseline justify-between border-b border-border py-4"
          >
            <span className="text-lg font-medium text-heading">{tool.name}</span>
            <span className="text-sm text-muted-custom">replaces {tool.replaces}</span>
          </div>
        ))}
      </div>
    </FadeIn>
    <FadeIn delay={0.2}>
      <p className="mt-10 text-center text-sm text-muted-custom">
        One auth system. One API pattern. All tools.
      </p>
    </FadeIn>
  </section>
);

export default Tools;
