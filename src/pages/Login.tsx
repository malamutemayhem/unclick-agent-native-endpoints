/**
 * Login page
 *
 * Magic link (email) + Google OAuth + Microsoft OAuth.
 * NO password field. NO GitHub button. Per preflight decisions.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import { useCanonical } from "@/hooks/use-canonical";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Check } from "lucide-react";
import { signInWithMagicLink, signInWithOAuth, useSession } from "@/lib/auth";
import { useEffect } from "react";

export default function LoginPage() {
  useCanonical("https://unclick.world/login");
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"magic" | "google" | "azure" | null>(null);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  // If already authenticated, bounce to memory admin.
  useEffect(() => {
    if (!sessionLoading && session) {
      navigate("/admin", { replace: true });
    }
  }, [sessionLoading, session, navigate]);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy("magic");
    try {
      await signInWithMagicLink(trimmed);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleOAuth(provider: "google" | "azure") {
    setError("");
    setBusy(provider);
    try {
      await signInWithOAuth(provider);
      // Redirect happens via Supabase. Nothing else to do here.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start sign in. Try again.");
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <FadeIn>
          <div className="rounded-2xl border border-border/60 bg-card/40 p-8 shadow-lg">
            <h1 className="text-2xl font-semibold text-heading">Sign in to UnClick</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Magic link or one click with Google or Microsoft. No passwords.
            </p>

            {sent ? (
              <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-5">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">Check your email</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  We sent a magic link to <span className="font-mono text-heading">{email}</span>.
                  Click it to finish signing in. The link expires in 15 minutes.
                </p>
              </div>
            ) : (
              <>
                <form onSubmit={handleMagicLink} className="mt-6 space-y-3">
                  <div>
                    <Label htmlFor="email" className="text-xs text-muted-foreground">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError("");
                      }}
                      placeholder="you@example.com"
                      className="mt-1"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={busy !== null}
                    className="w-full bg-primary text-black hover:opacity-90"
                  >
                    {busy === "magic" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending link
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send magic link
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    or
                  </span>
                  <div className="h-px flex-1 bg-border/60" />
                </div>

                <div className="mt-6 space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => handleOAuth("google")}
                    className="w-full"
                  >
                    {busy === "google" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <GoogleIcon className="mr-2 h-4 w-4" />
                    )}
                    Continue with Google
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => handleOAuth("azure")}
                    className="w-full"
                  >
                    {busy === "azure" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <MicrosoftIcon className="mr-2 h-4 w-4" />
                    )}
                    Continue with Microsoft
                  </Button>
                </div>
              </>
            )}

            {error ? (
              <p className="mt-4 text-xs text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <p className="mt-6 text-center text-xs text-muted-foreground">
              New here?{" "}
              <Link to="/signup" className="text-primary underline-offset-2 hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        </FadeIn>
      </main>
      <Footer />
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M12 1h10v10H12z" />
      <path fill="#00A4EF" d="M1 12h10v10H1z" />
      <path fill="#FFB900" d="M12 12h10v10H12z" />
    </svg>
  );
}
