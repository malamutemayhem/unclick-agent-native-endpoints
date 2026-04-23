import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSession } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const [status, setStatus] = useState<"checking" | "admin" | "denied">("checking");

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    let cancelled = false;
    fetch("/api/memory-admin?action=admin_profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled) return;
        setStatus(body && (body as { is_admin?: boolean }).is_admin ? "admin" : "denied");
      })
      .catch(() => {
        if (!cancelled) setStatus("denied");
      });
    return () => { cancelled = true; };
  }, [session?.access_token]);

  if (loading || status === "checking") {
    return (
      <div className="flex items-center gap-2 py-12 text-[#666]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Verifying access...</span>
      </div>
    );
  }

  if (status === "denied") {
    return <Navigate to="/admin/you" replace />;
  }

  return <>{children}</>;
}
