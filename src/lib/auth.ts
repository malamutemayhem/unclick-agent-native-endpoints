/**
 * UnClick Phase 2 - Auth helpers.
 *
 * Thin wrapper around @supabase/supabase-js auth. The shared `supabase`
 * client in src/lib/supabase.ts already reads VITE_SUPABASE_URL +
 * VITE_SUPABASE_ANON_KEY, which is exactly what magic-link + OAuth
 * flows need. No extra config.
 *
 * Decisions locked in preflight:
 *   - Magic link + Google + Microsoft only (no GitHub, no passwords)
 *   - Default Supabase email template for this phase
 *   - Redirect URLs are allowlisted on the Supabase side for
 *     https://unclick.world/auth/callback and
 *     http://localhost:5173/auth/callback
 */

import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type SupportedOAuthProvider = "google" | "azure";

/** Return the redirect URL for the current origin. */
export function authCallbackUrl(): string {
  if (typeof window === "undefined") return "https://unclick.world/auth/callback";
  return `${window.location.origin}/auth/callback`;
}

/** Send a magic link to the given email. */
export async function signInWithMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: authCallbackUrl() },
  });
  if (error) throw error;
}

/** Kick off an OAuth flow. Supabase handles the redirect. */
export async function signInWithOAuth(
  provider: SupportedOAuthProvider,
): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: authCallbackUrl() },
  });
  if (error) throw error;
}

/** Sign out the current session. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * React hook returning the current Supabase session (or null).
 * Subscribes to auth state changes for the lifetime of the component.
 *
 * Return shape:
 *   { session, user, loading }
 *
 *   - loading is true only on the initial load before we've checked
 *     the stored session. After that, session === null means
 *     "confirmed not authenticated", not "still loading".
 */
export function useSession(): {
  session: Session | null;
  user: User | null;
  loading: boolean;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (cancelled) return;
      setSession(next);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}
