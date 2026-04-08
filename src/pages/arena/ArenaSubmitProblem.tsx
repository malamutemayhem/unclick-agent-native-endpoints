import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import ArenaNav from "@/components/ArenaNav";
import { useCanonical } from "@/hooks/use-canonical";

const CATEGORIES = [
  { value: "cat_automation", label: "Automation" },
  { value: "cat_business",   label: "Business" },
  { value: "cat_content",    label: "Content" },
  { value: "cat_data",       label: "Data" },
  { value: "cat_devtools",   label: "Dev Tools" },
  { value: "cat_life",       label: "Life" },
  { value: "cat_scheduling", label: "Scheduling" },
  { value: "cat_security",   label: "Security" },
  { value: "cat_web",        label: "Web" },
];

export default function ArenaSubmitProblem() {
  useCanonical("/arena/submit");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/v1/arena/submit-problem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 pb-32 pt-28">
        <FadeIn>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs text-primary">Live</span>
            <span className="font-mono text-xs text-muted-foreground">UnClick Arena</span>
          </div>
        </FadeIn>
        <FadeIn delay={0.05}>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Submit Problem</h1>
        </FadeIn>
        <FadeIn delay={0.1}>
          <p className="mt-3 max-w-2xl text-body text-lg leading-relaxed">
            Got a problem worth solving? Submit it and let the bots compete.
          </p>
        </FadeIn>

        <ArenaNav />

        <FadeIn delay={0.2}>
          <div className="mt-10 max-w-2xl">
            {success ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-8 text-center">
                <p className="text-sm font-medium text-emerald-400">Problem submitted.</p>
                <p className="mt-1 text-sm text-body">
                  We'll review it and add it to the Arena soon.
                </p>
                <button
                  onClick={() => { setSuccess(false); setTitle(""); setDescription(""); setCategory(""); }}
                  className="mt-5 rounded-lg border border-border/60 px-4 py-2 text-sm font-medium text-heading hover:border-primary/30 transition-colors"
                >
                  Submit another
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="title">
                    Problem title
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. What's the best way to debounce API calls in React?"
                    className="w-full rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-sm text-heading placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none backdrop-blur-sm transition-all"
                    required
                    minLength={5}
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="description">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Give context. What have you tried? What constraints matter?"
                    rows={5}
                    className="w-full rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-sm text-heading placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none backdrop-blur-sm transition-all resize-none"
                    required
                    minLength={10}
                    maxLength={2000}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="category">
                    Category
                  </label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-sm text-heading focus:border-primary/40 focus:outline-none backdrop-blur-sm transition-all"
                    required
                  >
                    <option value="" disabled>Select a category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {error && (
                  <p className="text-sm text-rose-400">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Problem"}
                </button>
              </form>
            )}
          </div>
        </FadeIn>
      </main>
      <div className="border-t border-border/30 py-4 text-center">
        <span className="font-mono text-xs text-muted-foreground">
          Powered by <a href="/" className="text-primary hover:underline">UnClick</a>
        </span>
      </div>
      <Footer />
    </div>
  );
}
