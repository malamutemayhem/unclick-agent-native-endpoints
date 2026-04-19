/**
 * ProjectProvider -- tenant-scoped list of mc_projects plus the currently
 * active project slug. Wraps the admin routes so any page can read or
 * change the active project without prop drilling.
 *
 * The active slug is stored in the URL (?project=slug). `null` means
 * "All Projects" (org-global view).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useSession } from "@/lib/auth";

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  repo_url: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface ProjectContextValue {
  projects: Project[];
  activeSlug: string | null;
  activeProject: Project | null;
  setActiveSlug: (slug: string | null) => void;
  refresh: () => Promise<void>;
  loading: boolean;
}

const Ctx = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSlug = searchParams.get("project");

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch("/api/memory-admin?action=project_list", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const body = await res.json();
      setProjects((body.data ?? []) as Project[]);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    void refresh();
  }, [session, refresh]);

  const setActiveSlug = useCallback(
    (slug: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (slug) next.set("project", slug);
      else next.delete("project");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const activeProject = useMemo(
    () => projects.find((p) => p.slug === activeSlug) ?? null,
    [projects, activeSlug],
  );

  const value = useMemo<ProjectContextValue>(
    () => ({ projects, activeSlug, activeProject, setActiveSlug, refresh, loading }),
    [projects, activeSlug, activeProject, setActiveSlug, refresh, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      projects: [],
      activeSlug: null,
      activeProject: null,
      setActiveSlug: () => {},
      refresh: async () => {},
      loading: false,
    };
  }
  return ctx;
}
