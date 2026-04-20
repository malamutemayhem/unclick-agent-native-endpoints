/**
 * /auth/callback
 *
 * Landing page for Supabase Auth magic-link clicks and OAuth redirects.
 * @supabase/supabase-js automatically picks up the hash / query
 * parameters and exchanges them for a session during client init, so
 * this page just has to wait for the session to be set and then
 * redirect the user to the app.
 *
 * If the URL carries an explicit error (e.g. expired link), Supabase
 * sends ?error=...&error_description=... which we surface inline.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSession } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session, loading } = useSession();

  const urlError = params.get("error_description") || params.get("error");
  const [timedOut, setTimedOut] = useState(false);
  const tracked = useRef(false);

  useEffect(() => {
    if (!loading && session) {
      // Fire auth_success to Umami exactly once per callback landing.
      // new_user inferred by comparing created_at with last_sign_in_at:
      // if they're within 10s of each other, this is a first-time
      // signup; otherwise it's a returning login.
      if (!tracked.current) {
        tracked.current = true;
        const user = session.user;
        const created = user?.created_at ? Date.parse(user.created_at) : 0;
        const lastSignIn = user?.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0;
        const newUser =
          created > 0 && lastSignIn > 0 && Math.abs(lastSignIn - created) < 10_000;
        const provider =
          (user?.app_metadata as { provider?: string } | undefined)?.provider ?? "unknown";
        track("auth_success", { new_user: newUser, provider });
      }
      navigate("/admin", { replace: true });
    }
  }, [loading, session, navigate]);

  // If we've been waiting more than 8 seconds with no session and no
  // URL error, something went wrong silently - nudge the user back
  // to /login so they can retry.
  useEffect(() => {
    if (urlError) return;
    const id = window.setTimeout(() => setTimedOut(true), 8000);
    return () => window.clearTimeout(id);
  }, [urlError]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-md px-4 py-24">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-center shadow-lg">
          {urlError ? (
            <>
              <h1 className="text-xl font-semibold text-heading">Sign in failed</h1>
              <p className="mt-2 text-sm text-muted-foreground">{urlError}</p>
              <button
                onClick={() => navigate("/login", { replace: true })}
                className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
              >
                Back to sign in
              </button>
            </>
          ) : timedOut ? (
            <>
              <h1 className="text-xl font-semibold text-heading">Still working on it</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This is taking longer than expected. Try signing in again.
              </p>
              <button
                onClick={() => navigate("/login", { replace: true })}
                className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              <h1 className="mt-4 text-lg font-semibold text-heading">Signing you in</h1>
              <p className="mt-1 text-xs text-muted-foreground">One moment.</p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
