/**
 * Memory Setup Wizard
 *
 * BYOD (Bring Your Own Database) flow for connecting UnClick Memory to the
 * user's own Supabase project. Designed for the fewest-possible clicks:
 *
 *   Step 1 (Account)     - confirm / edit email, copy API key to clipboard
 *   Step 2 (Supabase)    - one paste of the service_role key; the URL is
 *                          auto-extracted from the JWT payload
 *   Step 3 (Done)        - drop-in MCP config snippet + success state
 *
 * If the serverless fn couldn't run the schema automatically (exec_sql RPC
 * isn't always available), we surface the SQL for a one-click copy-paste
 * into Supabase's SQL editor.
 */

import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import { useCanonical } from "@/hooks/use-canonical";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Database, Check, Copy, ExternalLink, KeyRound, Sparkles, AlertCircle, Loader2 } from "lucide-react";

const API_KEY_STORAGE = "unclick_api_key";
const EMAIL_STORAGE = "unclick_user_email";

type Step = 1 | 2 | 3;

interface SetupResult {
  success: boolean;
  supabase_url?: string;
  schema_installed?: boolean;
  schema_sql?: string;
  message?: string;
  error?: string;
}

function decodeProjectRef(jwt: string): string | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { ref?: string; role?: string };
    if (payload.role !== "service_role") return null;
    return payload.ref ?? null;
  } catch {
    return null;
  }
}

function StepBadge({ num, active, done, label }: { num: number; active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full border font-mono text-sm transition-colors ${
          done
            ? "border-primary bg-primary/20 text-primary"
            : active
              ? "border-primary bg-primary text-black"
              : "border-border/50 bg-card/30 text-muted-foreground"
        }`}
      >
        {done ? <Check className="h-4 w-4" /> : num}
      </div>
      <span className={`text-sm ${active ? "text-heading font-medium" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}

function StepLine({ done }: { done: boolean }) {
  return <div className={`h-px w-10 ${done ? "bg-primary" : "bg-border/50"}`} />;
}

export default function MemorySetupPage() {
  useCanonical("/memory/setup");

  const [step, setStep] = useState<Step>(1);
  const [apiKey, setApiKey] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [emailEditable, setEmailEditable] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [configCopied, setConfigCopied] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  const [serviceRoleKey, setServiceRoleKey] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<SetupResult | null>(null);

  // Auto-populate from localStorage, as set by ApiKeySignup.
  useEffect(() => {
    try {
      const storedKey = localStorage.getItem(API_KEY_STORAGE) ?? "";
      const storedEmail = localStorage.getItem(EMAIL_STORAGE) ?? "";
      setApiKey(storedKey);
      setEmail(storedEmail);
    } catch {
      /* ignore */
    }
  }, []);

  const detectedRef = useMemo(() => (serviceRoleKey ? decodeProjectRef(serviceRoleKey.trim()) : null), [serviceRoleKey]);
  const detectedUrl = detectedRef ? `https://${detectedRef}.supabase.co` : null;
  const needsManualUrl = serviceRoleKey.trim().length > 40 && !detectedRef;

  const mcpConfigSnippet = useMemo(() => {
    return JSON.stringify(
      {
        mcpServers: {
          unclick: {
            command: "npx",
            args: ["-y", "@unclick/mcp-server"],
            env: {
              UNCLICK_API_KEY: apiKey || "your_api_key_here",
            },
          },
        },
      },
      null,
      2
    );
  }, [apiKey]);

  // ── Handlers ──

  const copy = async (text: string, setFlag: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setFlag(true);
      setTimeout(() => setFlag(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleSubmit = async () => {
    setError("");
    const trimmed = serviceRoleKey.trim();
    if (!trimmed) {
      setError("Paste your Supabase service_role key first.");
      return;
    }
    if (!apiKey) {
      setError("No UnClick API key found. Grab one from the homepage first.");
      return;
    }
    if (needsManualUrl && !manualUrl.trim()) {
      setError("We couldn't read the project from your key. Paste the Supabase URL too.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/memory-admin?action=setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          service_role_key: trimmed,
          supabase_url: manualUrl.trim() || undefined,
          email: email || undefined,
        }),
      });
      const data = (await res.json()) as SetupResult;
      if (!res.ok) {
        setError(data.error ?? "Setup failed. Check your key and try again.");
        setLoading(false);
        return;
      }
      setResult(data);
      setStep(3);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──

  const noApiKey = !apiKey;

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto max-w-3xl px-6 pb-32 pt-28">
        <FadeIn>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-mono text-primary">
            <Sparkles className="h-3 w-3" />
            One paste. You're done.
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Turn on cloud memory
          </h1>
          <p className="mt-2 max-w-xl text-sm text-body">
            Connect your own Supabase so memory syncs across every machine you use UnClick on. You own the
            data. We never see it.
          </p>
        </FadeIn>

        {/* Progress */}
        <FadeIn delay={0.05}>
          <div className="mt-8 flex items-center gap-3">
            <StepBadge num={1} label="Account" active={step === 1} done={step > 1} />
            <StepLine done={step > 1} />
            <StepBadge num={2} label="Supabase" active={step === 2} done={step > 2} />
            <StepLine done={step > 2} />
            <StepBadge num={3} label="Done" active={step === 3} done={false} />
          </div>
        </FadeIn>

        {/* Step 1: Account */}
        {step === 1 && (
          <FadeIn delay={0.1}>
            <section className="mt-10 rounded-2xl border border-border/40 bg-card/30 p-8">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-heading">
                <KeyRound className="h-5 w-5 text-primary" />
                Your UnClick account
              </h2>
              <p className="mt-1 text-sm text-body">
                This is who your memory belongs to. We pulled it from your signup.
              </p>

              <div className="mt-6 space-y-5">
                <div>
                  <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                    Email
                  </Label>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={!emailEditable}
                      placeholder={emailEditable ? "you@example.com" : "—"}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEmailEditable((v) => !v)}
                      className="shrink-0"
                    >
                      {emailEditable ? "Lock" : "Change"}
                    </Button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Used to send setup notifications. You can change it any time.
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">API key</Label>
                  {apiKey ? (
                    <div className="mt-1.5 flex gap-2">
                      <code className="flex-1 truncate rounded-md border border-border/40 bg-card/60 px-3 py-2 font-mono text-xs text-heading">
                        {apiKey}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => copy(apiKey, setKeyCopied)}
                        className="shrink-0"
                      >
                        {keyCopied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
                      <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
                      No API key found. <a href="/" className="underline">Grab one free here</a>, then come
                      back.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <Button onClick={() => setStep(2)} disabled={noApiKey}>
                  Continue
                </Button>
              </div>
            </section>
          </FadeIn>
        )}

        {/* Step 2: Supabase */}
        {step === 2 && (
          <FadeIn delay={0.1}>
            <section className="mt-10 rounded-2xl border border-border/40 bg-card/30 p-8">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-heading">
                <Database className="h-5 w-5 text-primary" />
                Connect your Supabase
              </h2>
              <p className="mt-1 text-sm text-body">
                Free tier works fine (500MB).{" "}
                <a
                  href="https://supabase.com/dashboard/new"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Create a project <ExternalLink className="h-3 w-3" />
                </a>
                , then grab your <span className="font-mono text-xs text-heading">service_role</span> key
                from Settings → API.
              </p>

              <div className="mt-6 space-y-5">
                <div>
                  <Label htmlFor="service-key" className="text-xs font-medium text-muted-foreground">
                    service_role key
                  </Label>
                  <textarea
                    id="service-key"
                    value={serviceRoleKey}
                    onChange={(e) => {
                      setServiceRoleKey(e.target.value);
                      setError("");
                    }}
                    rows={3}
                    placeholder="eyJhbGciOi..."
                    className="mt-1.5 w-full resize-none rounded-md border border-border/60 bg-card/60 px-3 py-2 font-mono text-xs text-heading placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Paste the key that starts with <span className="font-mono">eyJ</span>. NOT the anon
                    key — we need service_role to create tables.
                  </p>
                </div>

                {/* Auto-detected URL preview */}
                {detectedUrl && (
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-center gap-2 text-xs text-primary">
                      <Check className="h-3.5 w-3.5" />
                      Detected project:
                    </div>
                    <code className="mt-1 block font-mono text-xs text-heading">{detectedUrl}</code>
                  </div>
                )}

                {/* Fallback manual URL */}
                {needsManualUrl && (
                  <div>
                    <Label htmlFor="url" className="text-xs font-medium text-muted-foreground">
                      Supabase URL
                    </Label>
                    <Input
                      id="url"
                      type="url"
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                      placeholder="https://abc123.supabase.co"
                      className="mt-1.5"
                    />
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Couldn't read this from your key. Paste it from Settings → API.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">
                    <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
                    {error}
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>
                  Back
                </Button>
                <Button onClick={handleSubmit} disabled={loading || !serviceRoleKey.trim()}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
              </div>
            </section>
          </FadeIn>
        )}

        {/* Step 3: Done */}
        {step === 3 && result && (
          <FadeIn delay={0.1}>
            <section className="mt-10 rounded-2xl border border-primary/30 bg-primary/5 p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                  <Check className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-heading">Connected.</h2>
                  <p className="text-sm text-body">{result.message}</p>
                </div>
              </div>

              {/* Schema fallback: if we couldn't auto-install, show SQL to paste */}
              {result.schema_sql && !result.schema_installed && (
                <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                    <AlertCircle className="h-4 w-4" />
                    One more 10-second step
                  </h3>
                  <p className="mt-1 text-xs text-amber-100/80">
                    We couldn't run the schema automatically (Supabase's default setup blocks it). Paste
                    this into your SQL editor and click Run.
                  </p>
                  <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-body">
                    <li>
                      Open{" "}
                      <a
                        href={`${result.supabase_url}/project/_/sql/new`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        your SQL editor <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                    <li>Paste + Run</li>
                    <li>Done.</li>
                  </ol>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => copy(result.schema_sql ?? "", setSqlCopied)}
                      className="shrink-0"
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      {sqlCopied ? "Copied" : "Copy schema SQL"}
                    </Button>
                  </div>
                </div>
              )}

              {/* MCP config snippet */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-heading">Drop this into your MCP config</h3>
                <p className="mt-1 text-xs text-body">
                  The server will fetch your Supabase credentials securely using your API key.
                </p>
                <div className="mt-3 rounded-md border border-border/40 bg-card/60">
                  <pre className="overflow-x-auto p-3 font-mono text-[11px] text-heading">
                    {mcpConfigSnippet}
                  </pre>
                </div>
                <Button
                  variant="outline"
                  onClick={() => copy(mcpConfigSnippet, setConfigCopied)}
                  className="mt-3"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {configCopied ? "Copied" : "Copy config"}
                </Button>
              </div>

              <div className="mt-8 flex items-center justify-between rounded-lg border border-border/40 bg-card/30 p-4 text-xs text-body">
                <span>Want to see what's in your memory?</span>
                <a href="/memory/admin" className="text-primary hover:underline">
                  Open admin &rarr;
                </a>
              </div>
            </section>
          </FadeIn>
        )}

        {/* Subtle trust footer */}
        <FadeIn delay={0.15}>
          <p className="mt-8 text-center text-[11px] text-muted-foreground">
            Your service_role key is encrypted at rest with a key derived from your UnClick API key. Only
            you can decrypt it.
          </p>
        </FadeIn>
      </main>

      <Footer />
    </div>
  );
}
