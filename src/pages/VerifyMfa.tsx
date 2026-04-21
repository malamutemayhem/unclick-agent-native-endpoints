/**
 * /auth/verify-mfa
 *
 * Second-factor challenge page. Reached automatically after magic-link or
 * OAuth sign-in when the user has TOTP enrolled (aal2 required).
 * Creates a challenge, accepts a 6-digit code, verifies it, then
 * navigates to /admin.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Loader2 } from "lucide-react";

export default function VerifyMfaPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [initialising, setInitialising] = useState(true);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate("/login", { replace: true });
      return;
    }
    (async () => {
      // Check if we actually need MFA - if already aal2, go straight to admin
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") {
        navigate("/admin", { replace: true });
        return;
      }
      // Find the enrolled TOTP factor
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.find((f) => f.status === "verified");
      if (!totp) {
        // No verified factor - session is fine as aal1, go to admin
        navigate("/admin", { replace: true });
        return;
      }
      setFactorId(totp.id);
      // Create the challenge immediately so we're ready for user input
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: totp.id,
      });
      if (challengeErr || !challenge) {
        setError(challengeErr?.message ?? "Could not start verification. Try signing in again.");
        setInitialising(false);
        return;
      }
      setChallengeId(challenge.id);
      setInitialising(false);
      setTimeout(() => codeRef.current?.focus(), 100);
    })();
  }, [loading, session, navigate]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || !challengeId || code.length !== 6) return;
    setVerifying(true);
    setError(null);
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: code.trim(),
    });
    if (verifyErr) {
      setError(verifyErr.message);
      setCode("");
      setVerifying(false);
      codeRef.current?.focus();
      // Create a fresh challenge - old one is consumed on verify attempt
      if (factorId) {
        const { data: fresh } = await supabase.auth.mfa.challenge({ factorId });
        if (fresh) setChallengeId(fresh.id);
      }
      return;
    }
    navigate("/admin", { replace: true });
  }

  const isReady = !initialising && challengeId;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-md px-4 py-24">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-center shadow-lg">
          {initialising ? (
            <>
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">Setting up verification...</p>
            </>
          ) : !isReady ? (
            <>
              <h1 className="text-xl font-semibold text-heading">Verification failed</h1>
              <p className="mt-2 text-sm text-muted-foreground">{error ?? "Could not start verification."}</p>
              <button
                onClick={() => navigate("/login", { replace: true })}
                className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-heading">Two-step verification</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter the 6-digit code from your authenticator app.
              </p>
              <form onSubmit={(e) => void handleVerify(e)} className="mt-6">
                <input
                  ref={codeRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  disabled={verifying}
                  className="w-full rounded-md border border-border bg-background px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-heading placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none disabled:opacity-60"
                />
                {error && (
                  <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={verifying || code.length !== 6}
                  className="mt-4 w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {verifying ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    "Verify"
                  )}
                </button>
              </form>
              <button
                onClick={() => navigate("/login", { replace: true })}
                className="mt-4 text-xs text-muted-foreground hover:text-heading"
              >
                Sign in with a different account
              </button>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
