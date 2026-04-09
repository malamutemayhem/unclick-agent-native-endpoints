import { Link } from "react-router-dom";
import FadeIn from "@/components/FadeIn";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const files = [
  {
    name: "CLAUDE.md",
    description:
      "Drop this in your project root. Teaches your AI assistant everything about UnClick — tool names, API patterns, error handling, mobile standards, and when to stop and plan before coding.",
    href: "/vibe-coding/CLAUDE.md",
    note: "Also works as .cursorrules",
  },
  {
    name: "PLANNING.md",
    description:
      "Fill this in with your AI before writing any code. Five questions, five minutes. Prevents hours of building the wrong thing.",
    href: "/vibe-coding/PLANNING.md",
    note: "Template — copy and rename per project",
  },
  {
    name: "CHECKLIST.md",
    description:
      "Run through this before submitting. Your AI can check most items automatically — just paste the list and ask.",
    href: "/vibe-coding/CHECKLIST.md",
    note: "Pre-submission quality gate",
  },
  {
    name: "REVIEW-RUBRIC.md",
    description:
      "The exact criteria our automated review uses. Read it once and you'll know what we're looking for before we look.",
    href: "/vibe-coding/REVIEW-RUBRIC.md",
    note: "Public — no surprises at review time",
  },
];

const steps = [
  {
    number: "01",
    title: "Download CLAUDE.md",
    body: "Drop it in your project root. Claude, Cursor, Copilot, and Windsurf all pick it up automatically. Your AI now knows what UnClick is, what tools are available, and what good looks like.",
  },
  {
    number: "02",
    title: "Plan before you code",
    body: "Open PLANNING.md with your AI. Five questions: who is this for, what does it do, what goes wrong, which tools does it need, what does it look like on a phone. Takes 5 minutes. Saves hours.",
  },
  {
    number: "03",
    title: "Build with context",
    body: "Your AI assistant has everything it needs. Tool names, API patterns, error handling, mobile standards. Most quality problems don't happen when the AI starts from a good brief.",
  },
  {
    number: "04",
    title: "Run the checklist",
    body: "Before submitting, ask your AI to go through CHECKLIST.md line by line. It can check most items automatically and tell you what's still open.",
  },
];

const VibeCoding = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    <main className="mx-auto max-w-4xl px-6 py-24">
      <FadeIn>
        <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
          Building with AI
        </span>
      </FadeIn>

      <FadeIn delay={0.05}>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          The UnClick Vibe Coding Framework
        </h1>
      </FadeIn>

      <FadeIn delay={0.1}>
        <p className="mt-4 text-body max-w-2xl leading-relaxed">
          AI coding tools move fast. The apps they produce vary a lot. This framework gives your AI
          assistant the right context upfront — so the gap between "vibe coded in an afternoon" and
          "actually good" disappears.
        </p>
        <p className="mt-3 text-body max-w-2xl leading-relaxed">
          Four files. Drop them in your project. Your AI reads them. Most quality problems never happen.
        </p>
      </FadeIn>

      {/* Files to download */}
      <FadeIn delay={0.15}>
        <div className="mt-16">
          <h2 className="text-lg font-semibold text-heading">The files</h2>
          <p className="mt-2 text-sm text-body">
            Download individually or{" "}
            <a
              href="https://github.com/unclick-world/vibe-coding-framework"
              className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              clone the repo
            </a>
            .
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {files.map((file, i) => (
              <FadeIn key={file.name} delay={0.15 + i * 0.06}>
                <div className="rounded-lg border border-border/40 bg-card/30 p-5 hover:border-primary/20 hover:bg-card/50 transition-all h-full flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-sm font-semibold text-heading">{file.name}</span>
                    <a
                      href={file.href}
                      download
                      className="shrink-0 rounded border border-border/60 px-2.5 py-1 text-xs font-medium text-body hover:border-primary/30 hover:text-heading transition-colors"
                    >
                      Download
                    </a>
                  </div>
                  <p className="mt-2 text-xs text-body leading-relaxed flex-1">{file.description}</p>
                  <p className="mt-3 font-mono text-[10px] text-muted-foreground">{file.note}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* How it works */}
      <FadeIn delay={0.35}>
        <div className="mt-20">
          <h2 className="text-lg font-semibold text-heading">How it works</h2>

          <div className="mt-8 space-y-8">
            {steps.map((step, i) => (
              <FadeIn key={step.number} delay={0.35 + i * 0.06}>
                <div className="flex gap-6">
                  <span className="font-mono text-2xl font-bold text-primary/30 shrink-0 w-8 leading-tight">
                    {step.number}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-heading">{step.title}</h3>
                    <p className="mt-1.5 text-sm text-body leading-relaxed">{step.body}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Review */}
      <FadeIn delay={0.55}>
        <div className="mt-20 rounded-lg border border-border/40 bg-card/20 p-8">
          <h2 className="text-lg font-semibold text-heading">What happens at review</h2>
          <p className="mt-3 text-sm text-body leading-relaxed max-w-2xl">
            Every submission goes through automated checks first — build errors, exposed secrets,
            missing metadata, Lighthouse scores, mobile layout. If those pass, an AI scan checks
            whether the app does what it claims, handles errors, and uses UnClick tools correctly.
            Certified apps get a human review on top.
          </p>
          <p className="mt-3 text-sm text-body leading-relaxed max-w-2xl">
            The rubric is public. If your app fails, you get a specific report with what failed and
            how to fix it. Resubmit as many times as you need — no penalty, no waiting period.
          </p>
          <a
            href="/vibe-coding/REVIEW-RUBRIC.md"
            className="mt-4 inline-block text-xs text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
          >
            Read the full review rubric
          </a>
        </div>
      </FadeIn>

      {/* CTA */}
      <FadeIn delay={0.65}>
        <div className="mt-16 flex flex-col sm:flex-row items-start gap-4">
          <a
            href="/vibe-coding/CLAUDE.md"
            download
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Download CLAUDE.md
          </a>
          <Link
            to="/docs"
            className="rounded-md border border-border/60 px-5 py-2.5 text-sm font-medium text-body hover:border-primary/30 hover:text-heading transition-colors"
          >
            Read the developer docs
          </Link>
        </div>
      </FadeIn>
    </main>

    <Footer />
  </div>
);

export default VibeCoding;
