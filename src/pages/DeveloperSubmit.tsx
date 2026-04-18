import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";

const CATEGORIES = [
  "AU-specific",
  "Security",
  "Productivity",
  "Finance",
  "Weather",
  "Sports",
  "Entertainment",
  "Science",
  "Transport",
  "Other",
];

type SubmitMode = "repo" | "paste";

export default function DeveloperSubmitPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<SubmitMode>("repo");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState({
    toolName: "",
    category: "Other",
    description: "",
    repoUrl: "",
    toolCode: "",
    email: "",
  });

  const set =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const body = {
      toolName: form.toolName,
      category: form.category,
      description: form.description,
      repoUrl: mode === "repo" ? form.repoUrl : undefined,
      toolCode: mode === "paste" ? form.toolCode : undefined,
      email: form.email,
    };

    try {
      const res = await fetch("/api/developer-submit-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Request failed with status ${res.status}`);
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-5xl px-6 pb-32 pt-28">
          <FadeIn>
            <div className="mx-auto max-w-lg rounded-2xl border border-primary/20 bg-primary/[0.03] p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <span className="font-mono text-xl text-primary">+</span>
              </div>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight text-heading">
                Got it.
              </h1>
              <p className="mt-3 text-sm text-body leading-relaxed">
                We will review your tool within 24 hours and email you at{" "}
                <span className="font-medium text-heading">{form.email}</span> with feedback or
                approval. While you wait, come say hello in our developer Discord.
              </p>
              <a
                href="https://discord.gg/unclick"
                className="mt-6 inline-block rounded-md border border-border/60 bg-card/20 px-5 py-2 text-sm font-medium text-heading transition-colors hover:bg-card/40"
                target="_blank"
                rel="noopener noreferrer"
              >
                Join the Discord
              </a>
              <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={() => {
                    setStatus("idle");
                    setForm({
                      toolName: "",
                      category: "Other",
                      description: "",
                      repoUrl: "",
                      toolCode: "",
                      email: "",
                    });
                  }}
                  className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-heading"
                >
                  Submit another tool
                </button>
                <span className="hidden text-muted-foreground sm:block">or</span>
                <button
                  onClick={() => navigate("/developers")}
                  className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-heading"
                >
                  Back to Developers
                </button>
              </div>
            </div>
          </FadeIn>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 pb-32 pt-28">
        <FadeIn>
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            Developer Program
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-heading">
            Submit a tool
          </h1>
          <p className="mt-2 text-sm text-body">
            Founding developer submissions are reviewed within 24 hours.
            You will hear back by email with feedback or approval.
          </p>
        </FadeIn>

        <FadeIn delay={0.05}>
          {/*
            Progressive enhancement: form has a real action + method so it works
            without JavaScript. The JS handler calls e.preventDefault() and takes
            over when available.
          */}
          <form
            action="/api/developer-submit-tool"
            method="POST"
            onSubmit={handleSubmit}
            className="mt-10 max-w-2xl space-y-6"
          >
            {/* Tool name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-heading" htmlFor="toolName">
                Tool name
              </label>
              <input
                id="toolName"
                name="toolName"
                type="text"
                required
                value={form.toolName}
                onChange={set("toolName")}
                placeholder="e.g. ABN Lookup"
                className="w-full rounded-lg border border-border/40 bg-card/20 px-4 py-2.5 text-sm text-heading placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-heading" htmlFor="description">
                Description{" "}
                <span className="font-normal text-muted-foreground">(max 200 characters)</span>
              </label>
              <textarea
                id="description"
                name="description"
                required
                maxLength={200}
                rows={3}
                value={form.description}
                onChange={set("description")}
                placeholder="What does your tool do? Which API does it wrap? Start with a verb."
                className="w-full resize-none rounded-lg border border-border/40 bg-card/20 px-4 py-2.5 text-sm text-heading placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors"
              />
              <p className="text-right font-mono text-xs text-muted-foreground">
                {form.description.length}/200
              </p>
            </div>

            {/* Tool source */}
            <div className="space-y-3">
              <span className="text-sm font-medium text-heading">Tool source</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("repo")}
                  className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                    mode === "repo"
                      ? "border-primary/40 bg-primary/10 text-heading"
                      : "border-border/40 bg-card/20 text-body hover:bg-card/40"
                  }`}
                >
                  GitHub repo URL
                </button>
                <button
                  type="button"
                  onClick={() => setMode("paste")}
                  className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                    mode === "paste"
                      ? "border-primary/40 bg-primary/10 text-heading"
                      : "border-border/40 bg-card/20 text-body hover:bg-card/40"
                  }`}
                >
                  Paste tool file
                </button>
              </div>

              {mode === "repo" ? (
                <input
                  name="repoUrl"
                  type="url"
                  required
                  value={form.repoUrl}
                  onChange={set("repoUrl")}
                  placeholder="https://github.com/yourname/your-tool"
                  className="w-full rounded-lg border border-border/40 bg-card/20 px-4 py-2.5 text-sm text-heading placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              ) : (
                <textarea
                  name="toolCode"
                  required
                  rows={12}
                  value={form.toolCode}
                  onChange={set("toolCode")}
                  placeholder="Paste your TypeScript tool file here."
                  className="w-full resize-y rounded-lg border border-border/40 bg-card/20 px-4 py-2.5 font-mono text-xs text-heading placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              )}
            </div>

            {/* Contact email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-heading" htmlFor="email">
                Contact email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={form.email}
                onChange={set("email")}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border/40 bg-card/20 px-4 py-2.5 text-sm text-heading placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors"
              />
              <p className="text-xs text-muted-foreground">
                Used only to send you review feedback or approval.
              </p>
            </div>

            {/* Category (optional) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-heading" htmlFor="category">
                Category{" "}
                <span className="font-normal text-muted-foreground">(optional, defaults to Other)</span>
              </label>
              <select
                id="category"
                name="category"
                value={form.category}
                onChange={set("category")}
                className="w-full rounded-lg border border-border/40 bg-card/20 px-4 py-2.5 text-sm text-heading focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Error message */}
            {status === "error" && (
              <div className="rounded-lg border border-rose-400/20 bg-rose-400/[0.04] px-4 py-3 text-sm text-rose-400">
                {errorMsg}
              </div>
            )}

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={status === "submitting"}
                className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {status === "submitting" ? "Submitting..." : "Submit tool"}
              </button>
            </div>
          </form>
        </FadeIn>
      </main>
      <Footer />
    </div>
  );
}
