import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export async function signInWithMagicLink(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}

export async function signInWithOAuth(provider: "google" | "azure") {
  return supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}

export async function signOut() {
  // Clear the UnClick api_key from localStorage on sign-out so the next
  // user on this browser does not inherit the previous user's key. See
  // issue #60 (cross-tenant memory leak via stale localStorage key).
  try {
    localStorage.removeItem("unclick_api_key");
  } catch {
    // localStorage can be unavailable in private-mode / SSR; ignore.
  }
  return supabase.auth.signOut();
}

/**
 * React hook returning the current Supabase session.
 *
 * Return shape (stable across callers — do NOT regress to `Session | null`):
 *   { session, user, loading }
 *
 *   - session: the current Session, or null if signed out
 *   - user:    convenience alias for session?.user ?? null
 *   - loading: true only before the initial getSession() resolves
 *
 * A regression in c209234 collapsed this to `Session | null` and broke
 * every caller the moment a fresh build hit prod. Kept as an object.
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
