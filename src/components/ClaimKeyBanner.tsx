/**
 * ClaimKeyBanner
 *
 * Shown at the top of authenticated pages (today: /memory/admin) when
 * the browser has an anonymous unclick_api_key in localStorage that
 * isn't yet linked to the signed-in auth.users row. Clicking Claim
 * calls /api/memory-admin?action=claim_api_key which runs a
 * server-side check that the api_keys.email matches the session user
 * email, then sets api_keys.user_id = session.user.id.
 *
 * If the localStorage api_key has no email column or the email doesn't
 * match the signed-in user, the claim request returns a clear error
 * and the banner surfaces it inline rather than silently failing.
 */

import { useEffect, useState } from "react";
import { Loader2, Link2, X, Check } from "lucide-react";
import { useSession } from "@/lib/auth";

const STORAGE_KEY = "unclick_api_key";
const CLAIM_DISMISSED = "unclick_claim_dismissed";

type State = "hidden" | "offer" | "claiming" | "done" | "error";

export default function ClaimKeyBanner() {
  const { session } = useSession();
  const [state, setState] = useState<State>("hidden");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) {
      setState("hidden");
      return;
    }
    if (localStorage.getItem(CLAIM_DISMISSED) === "1") {
      setState("hidden");
      return;
    }
    const storedKey = localStorage.getItem(STORAGE_KEY);
    if (!storedKey) {
      setState("hidden");
      return;
    }
    setState("offer");
  }, [session]);

  async function claim() {
    if (!session) return;
    const storedKey = localStorage.getItem(STORAGE_KEY);
    if (!storedKey) return;

    setError("");
    setState("claiming");
    try {
      const res = await fetch("/api/memory-admin?action=claim_api_key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ api_key: storedKey }),
      });
      const body = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !body.success) {
        throw new Error(body.error || `Claim failed (HTTP ${res.status})`);
      }
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed. Try again.");
      setState("error");
    }
  }

  function dismiss() {
    localStorage.setItem(CLAIM_DISMISSED, "1");
    setState("hidden");
  }

  if (state === "hidden") return null;

  return (
    <div className="mx-auto mb-6 flex w-full max-w-4xl items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
      <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="flex-1 text-sm">
        {state === "offer" || state === "claiming" ? (
          <>
            <p className="font-medium text-heading">Link your anonymous API key to this account</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              We found an UnClick API key saved in this browser. Linking it to your account lets
              you manage it from anywhere and keeps your memory connected.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={claim}
                disabled={state === "claiming"}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-60"
              >
                {state === "claiming" ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Linking
                  </>
                ) : (
                  "Link key to account"
                )}
              </button>
              <button
                onClick={dismiss}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-body hover:underline"
              >
                Not now
              </button>
            </div>
          </>
        ) : state === "done" ? (
          <>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              <p className="font-medium text-heading">API key linked</p>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your saved key is now tied to this account.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium text-heading">Couldn't link that key</p>
            <p className="mt-0.5 text-xs text-red-400">{error}</p>
            <button
              onClick={() => setState("offer")}
              className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:text-body hover:underline"
            >
              Try again
            </button>
          </>
        )}
      </div>
      <button
        onClick={dismiss}
        className="rounded-md p-1 text-muted-foreground hover:bg-card/60 hover:text-body"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
