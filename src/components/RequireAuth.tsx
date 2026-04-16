/**
 * RequireAuth - client-side route guard.
 *
 * Wraps a route element. If the user isn't authenticated, redirects
 * to /login with a ?next= param so we can bounce them back after sign
 * in. Used today on /memory/admin; any future /app/* route should be
 * wrapped in this too.
 */

import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <>{children}</>;
}
