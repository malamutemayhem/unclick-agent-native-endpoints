/**
 * AdminProjects - /admin/projects
 *
 * CRUD for mc_projects. Org-global (no project_id) stays the default
 * scope, so users without projects see an empty list and nothing else
 * changes in their memory behavior.
 */

import { useState } from "react";
import { useSession } from "@/lib/auth";
import { useProject, type Project } from "@/lib/project-context";
import {
  FolderKanban,
  Plus,
  Star,
  Trash2,
  Pencil,
  ExternalLink,
  Loader2,
  X,
  Check,
} from "lucide-react";

interface FormState {
  id?: string;
  name: string;
  slug: string;
  description: string;
  repo_url: string;
}

const BLANK_FORM: FormState = { name: "", slug: "", description: "", repo_url: "" };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function AdminProjects() {
  const { session } = useSession();
  const { projects, refresh, loading } = useProject();
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
    };
  }

  function startCreate() {
    setEditing({ ...BLANK_FORM });
    setSlugTouched(false);
    setFormError(null);
  }

  function startEdit(p: Project) {
    setEditing({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description ?? "",
      repo_url: p.repo_url ?? "",
    });
    setSlugTouched(true);
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setFormError(null);
    try {
      const isUpdate = Boolean(editing.id);
      const action = isUpdate ? "project_update" : "project_create";
      const body: Record<string, unknown> = isUpdate
        ? {
            id: editing.id,
            name: editing.name.trim(),
            description: editing.description.trim(),
            repo_url: editing.repo_url.trim(),
          }
        : {
            name: editing.name.trim(),
            slug: editing.slug.trim(),
            description: editing.description.trim(),
            repo_url: editing.repo_url.trim(),
          };
      const res = await fetch(`/api/memory-admin?action=${action}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        setFormError(result.error ?? "Failed to save");
        return;
      }
      setEditing(null);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Project) {
    if (!confirm(`Delete project "${p.name}"? Its memory entries become org-global.`)) return;
    const res = await fetch("/api/memory-admin?action=project_delete", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: p.id }),
    });
    if (res.ok) await refresh();
  }

  async function handleSetDefault(p: Project) {
    const res = await fetch("/api/memory-admin?action=project_set_default", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: p.id }),
    });
    if (res.ok) await refresh();
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Projects</h1>
          <p className="mt-1 text-sm text-[#888]">
            Partition memory into named scopes. Org-global memory stays the default.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="inline-flex items-center gap-2 rounded-md border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-3 py-2 text-xs font-medium text-[#61C1C4] hover:bg-[#61C1C4]/20"
        >
          <Plus className="h-3.5 w-3.5" />
          New Project
        </button>
      </div>

      {editing && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-xl border border-[#61C1C4]/30 bg-[#111] p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              {editing.id ? "Edit project" : "New project"}
            </h2>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-md p-1 text-[#666] hover:bg-white/[0.04] hover:text-[#ccc]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="text-[#888]">Name</span>
              <input
                required
                value={editing.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setEditing((cur) =>
                    cur
                      ? {
                          ...cur,
                          name,
                          slug: !slugTouched && !cur.id ? slugify(name) : cur.slug,
                        }
                      : cur,
                  );
                }}
                className="mt-1 w-full rounded-md border border-white/[0.08] bg-[#0A0A0A] px-3 py-2 text-sm text-white focus:border-[#61C1C4] focus:outline-none"
              />
            </label>
            <label className="block text-xs">
              <span className="text-[#888]">
                Slug{editing.id ? " (immutable)" : ""}
              </span>
              <input
                required
                disabled={Boolean(editing.id)}
                value={editing.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setEditing((cur) => (cur ? { ...cur, slug: slugify(e.target.value) } : cur));
                }}
                className="mt-1 w-full rounded-md border border-white/[0.08] bg-[#0A0A0A] px-3 py-2 font-mono text-sm text-white focus:border-[#61C1C4] focus:outline-none disabled:opacity-50"
              />
            </label>
            <label className="block text-xs sm:col-span-2">
              <span className="text-[#888]">Description</span>
              <input
                value={editing.description}
                onChange={(e) =>
                  setEditing((cur) => (cur ? { ...cur, description: e.target.value } : cur))
                }
                className="mt-1 w-full rounded-md border border-white/[0.08] bg-[#0A0A0A] px-3 py-2 text-sm text-white focus:border-[#61C1C4] focus:outline-none"
              />
            </label>
            <label className="block text-xs sm:col-span-2">
              <span className="text-[#888]">Repository URL</span>
              <input
                value={editing.repo_url}
                onChange={(e) =>
                  setEditing((cur) => (cur ? { ...cur, repo_url: e.target.value } : cur))
                }
                placeholder="https://github.com/org/repo"
                className="mt-1 w-full rounded-md border border-white/[0.08] bg-[#0A0A0A] px-3 py-2 font-mono text-sm text-white focus:border-[#61C1C4] focus:outline-none"
              />
            </label>
          </div>
          {formError && (
            <p className="mt-3 text-xs text-red-400">{formError}</p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-md border border-white/[0.08] px-3 py-2 text-xs text-[#888] hover:bg-white/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-[#61C1C4] px-3 py-2 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              {editing.id ? "Save changes" : "Create project"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-[#666]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading projects...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-[#111] p-10 text-center">
          <FolderKanban className="mx-auto h-8 w-8 text-[#444]" />
          <p className="mt-3 text-sm text-[#888]">No projects yet.</p>
          <p className="mt-1 text-xs text-[#666]">
            Memory is org-global by default. Create a project to scope facts and context to a specific codebase or client.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onEdit={() => startEdit(p)}
              onDelete={() => handleDelete(p)}
              onSetDefault={() => handleSetDefault(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-white">{project.name}</h3>
            {project.is_default && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#E2B93B]/30 bg-[#E2B93B]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#E2B93B]">
                <Star className="h-2.5 w-2.5" /> default
              </span>
            )}
          </div>
          <code className="mt-0.5 block truncate font-mono text-[11px] text-[#61C1C4]">
            {project.slug}
          </code>
        </div>
      </div>

      {project.description && (
        <p className="mt-2 text-xs text-[#aaa]">{project.description}</p>
      )}

      {project.repo_url && (
        <a
          href={project.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 truncate font-mono text-[11px] text-[#888] hover:text-[#ccc]"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate">{project.repo_url}</span>
        </a>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!project.is_default && (
          <button
            onClick={onSetDefault}
            className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-[11px] text-[#888] hover:bg-white/[0.04] hover:text-[#ccc]"
          >
            <Star className="h-3 w-3" />
            Set default
          </button>
        )}
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-[11px] text-[#888] hover:bg-white/[0.04] hover:text-[#ccc]"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1 rounded-md border border-red-500/20 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      </div>
    </div>
  );
}
