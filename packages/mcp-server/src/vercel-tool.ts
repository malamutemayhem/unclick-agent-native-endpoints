// Vercel deployment management API.
// Docs: https://vercel.com/docs/rest-api
// Auth: VERCEL_TOKEN (Bearer)
// Base: https://api.vercel.com/

const VERCEL_BASE = "https://api.vercel.com";

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.VERCEL_TOKEN ?? "").trim();
  if (!key) throw new Error("api_key is required (or set VERCEL_TOKEN env var).");
  return key;
}

async function vercelRequest(
  token: string,
  method: "GET" | "POST" | "DELETE" | "PATCH",
  path: string,
  opts?: { params?: Record<string, string>; body?: unknown }
): Promise<Record<string, unknown>> {
  const qs = opts?.params ? "?" + new URLSearchParams(opts.params).toString() : "";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const init: RequestInit = { method, headers };
  if (opts?.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${VERCEL_BASE}${path}${qs}`, init);
  if (res.status === 401) throw new Error("Invalid Vercel token.");
  if (res.status === 403) throw new Error("Vercel: access forbidden. Check token scopes.");
  if (res.status === 404) throw new Error(`Vercel: resource not found at ${path}.`);
  if (res.status === 409) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vercel conflict (409): ${body || "resource already exists."}`);
  }
  if (res.status === 429) throw new Error("Vercel rate limit exceeded.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vercel HTTP ${res.status}: ${body || res.statusText}`);
  }
  // 204 No Content (e.g. DELETE) returns empty body
  if (res.status === 204) return {};
  return res.json() as Promise<Record<string, unknown>>;
}

// Backwards-compat shim for existing callers below.
async function vercelGet(
  token: string,
  path: string,
  params?: Record<string, string>
): Promise<Record<string, unknown>> {
  return vercelRequest(token, "GET", path, { params });
}

// list_vercel_deployments
export async function listVercelDeployments(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getApiKey(args);
    const params: Record<string, string> = {};
    if (args.app) params.app = String(args.app);
    if (args.limit) params.limit = String(args.limit);
    if (args.project_id) params.projectId = String(args.project_id);
    if (args.state) params.state = String(args.state);
    if (args.team_id) params.teamId = String(args.team_id);
    const data = await vercelGet(token, "/v6/deployments", params);
    const deployments = (data.deployments as Array<Record<string, unknown>>) ?? [];
    return {
      count: deployments.length,
      pagination: data.pagination,
      deployments: deployments.map((d) => ({
        uid: d.uid,
        name: d.name,
        url: d.url,
        state: d.state,
        ready_state: d.readyState,
        created: d.created,
        ready: d.ready,
        target: d.target,
        creator: (d.creator as Record<string, unknown> | undefined)?.email,
        meta: d.meta,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// get_vercel_deployment
export async function getVercelDeployment(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getApiKey(args);
    const id = String(args.id ?? "").trim();
    if (!id) return { error: "id is required." };
    const params: Record<string, string> = {};
    if (args.team_id) params.teamId = String(args.team_id);
    const data = await vercelGet(token, `/v13/deployments/${id}`, params);
    return {
      uid: data.uid,
      name: data.name,
      url: data.url,
      state: data.state,
      ready_state: data.readyState,
      created: data.created,
      ready: data.ready,
      building: data.building,
      target: data.target,
      type: data.type,
      regions: data.regions,
      creator: (data.creator as Record<string, unknown> | undefined)?.email,
      error: data.errorCode
        ? { code: data.errorCode, message: data.errorMessage }
        : null,
      meta: data.meta,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// list_vercel_projects
export async function listVercelProjects(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getApiKey(args);
    const params: Record<string, string> = {};
    if (args.limit) params.limit = String(args.limit);
    if (args.search) params.search = String(args.search);
    if (args.team_id) params.teamId = String(args.team_id);
    const data = await vercelGet(token, "/v9/projects", params);
    const projects = (data.projects as Array<Record<string, unknown>>) ?? [];
    return {
      count: projects.length,
      pagination: data.pagination,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        framework: p.framework,
        node_version: p.nodeVersion,
        updated_at: p.updatedAt,
        created_at: p.createdAt,
        latest_deployments: ((p.latestDeployments as Array<Record<string, unknown>>) ?? []).slice(0, 3).map((d) => ({
          uid: d.uid,
          url: d.url,
          state: d.readyState,
          target: d.target,
        })),
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// get_vercel_domain
export async function getVercelDomain(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getApiKey(args);
    const domain = String(args.domain ?? "").trim();
    if (!domain) return { error: "domain is required." };
    const params: Record<string, string> = {};
    if (args.team_id) params.teamId = String(args.team_id);
    const data = await vercelGet(token, `/v5/domains/${domain}`, params);
    const d = data.domain as Record<string, unknown> | undefined;
    return {
      name: d?.name,
      apex: d?.apexName,
      project_id: d?.projectId,
      verified: d?.verified,
      ns_verified_at: d?.nsVerifiedAt,
      cname_target: d?.cnamTarget,
      service_type: d?.serviceType,
      bought_at: d?.boughtAt,
      expires_at: d?.expiresAt,
      dns: d?.dns,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// get_vercel_env
export async function getVercelEnv(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getApiKey(args);
    const projectId = String(args.project_id ?? "").trim();
    if (!projectId) return { error: "project_id is required." };
    const params: Record<string, string> = {};
    if (args.team_id) params.teamId = String(args.team_id);
    if (args.decrypt) params.decrypt = "true";
    const data = await vercelGet(token, `/v9/projects/${projectId}/env`, params);
    const envs = (data.envs as Array<Record<string, unknown>>) ?? [];
    return {
      count: envs.length,
      env: envs.map((e) => ({
        id: e.id,
        key: e.key,
        value: e.value,
        type: e.type,
        target: e.target,
        git_branch: e.gitBranch,
        created_at: e.createdAt,
        updated_at: e.updatedAt,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// create_vercel_env
// Adds a single environment variable to a Vercel project.
// POST /v10/projects/{projectId}/env
// Accepts target as a CSV string ("production,preview,development") or an array.
// type defaults to "plain"; use "encrypted" for secrets or "sensitive" for
// reveal-once values.
export async function createVercelEnv(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getApiKey(args);
    const projectId = String(args.project_id ?? "").trim();
    const key = String(args.key ?? "").trim();
    const value = args.value === undefined ? "" : String(args.value);
    if (!projectId) return { error: "project_id is required." };
    if (!key) return { error: "key is required." };
    if (value === "") return { error: "value is required (use an empty string explicitly if intentional)." };

    // Normalize target: accept "production" | "production,preview" | ["production", "preview"]
    let target: string[];
    if (Array.isArray(args.target)) {
      target = (args.target as unknown[]).map((t) => String(t).trim()).filter(Boolean);
    } else if (typeof args.target === "string" && args.target.trim()) {
      target = args.target.split(",").map((t) => t.trim()).filter(Boolean);
    } else {
      // Sensible default: all three environments.
      target = ["production", "preview", "development"];
    }
    const validTargets = new Set(["production", "preview", "development"]);
    for (const t of target) {
      if (!validTargets.has(t)) {
        return { error: `Invalid target "${t}". Must be production, preview, or development.` };
      }
    }

    const type = String(args.type ?? "plain");
    if (!["plain", "encrypted", "sensitive", "secret", "system"].includes(type)) {
      return { error: `Invalid type "${type}".` };
    }

    const body: Record<string, unknown> = { key, value, type, target };
    if (args.comment) body.comment = String(args.comment);
    if (args.git_branch) body.gitBranch = String(args.git_branch);

    const params: Record<string, string> = {};
    if (args.team_id) params.teamId = String(args.team_id);
    // upsert=true lets us overwrite an existing value for the same key/target
    // combination instead of 409-ing — matches the "just make it so" mental
    // model most agent flows want.
    if (args.upsert !== false) params.upsert = "true";

    const data = await vercelRequest(token, "POST", `/v10/projects/${projectId}/env`, {
      params,
      body,
    });
    // Response shape varies: single item under data.created OR an array.
    const created =
      (data.created as Array<Record<string, unknown>> | Record<string, unknown> | undefined) ??
      data;
    return { ok: true, created };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// delete_vercel_env
// Removes an environment variable by its env id.
// DELETE /v9/projects/{projectId}/env/{envId}
export async function deleteVercelEnv(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getApiKey(args);
    const projectId = String(args.project_id ?? "").trim();
    const envId = String(args.env_id ?? "").trim();
    if (!projectId) return { error: "project_id is required." };
    if (!envId) return { error: "env_id is required (get it from vercel_get_env)." };
    const params: Record<string, string> = {};
    if (args.team_id) params.teamId = String(args.team_id);
    await vercelRequest(token, "DELETE", `/v9/projects/${projectId}/env/${envId}`, { params });
    return { ok: true, deleted: envId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// create_vercel_deployment
// Creates a new deployment, typically to redeploy the latest commit on a
// project — with optional build-cache skipping (the common "cache-off
// redeploy" use case when new serverless functions or env vars need to
// take effect).
// POST /v13/deployments
// Two modes:
//   1. Redeploy an existing deployment: pass { deployment_id }
//      Resolves that deployment, grabs its gitSource, and submits a fresh
//      deploy from the same commit.
//   2. Fresh deploy from git: pass { project_id, git_ref } (branch name or
//      SHA). Uses projects API to discover the repo's gitRepository.
// Pass force_new: true to disable build cache.
export async function createVercelDeployment(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getApiKey(args);
    const teamParam: Record<string, string> = {};
    if (args.team_id) teamParam.teamId = String(args.team_id);
    const forceNew = args.force_new === true || args.force_new === "true";
    const target = args.target === undefined ? "production" : String(args.target);

    let name = args.name ? String(args.name) : "";
    let gitSource: Record<string, unknown> | undefined;
    let meta: Record<string, unknown> | undefined;

    if (args.deployment_id) {
      // Mode 1: redeploy existing
      const depId = String(args.deployment_id).trim();
      const dep = await vercelRequest(token, "GET", `/v13/deployments/${depId}`, {
        params: teamParam,
      });
      name = name || String(dep.name ?? "");
      gitSource = dep.gitSource as Record<string, unknown> | undefined;
      meta = dep.meta as Record<string, unknown> | undefined;
      if (!gitSource) {
        return {
          error: "Source deployment has no gitSource; can't redeploy. Try fresh deploy mode instead.",
        };
      }
    } else if (args.project_id) {
      // Mode 2: fresh deploy from git
      const projectId = String(args.project_id).trim();
      const proj = await vercelRequest(token, "GET", `/v9/projects/${projectId}`, {
        params: teamParam,
      });
      name = name || String(proj.name ?? "");
      const link = proj.link as Record<string, unknown> | undefined;
      if (!link) {
        return { error: "Project is not linked to a git repo; can't deploy from git." };
      }
      const ref = args.git_ref ? String(args.git_ref) : "main";
      gitSource = {
        type: (link.type as string) ?? "github",
        repoId: link.repoId,
        ref,
      };
    } else {
      return { error: "Provide either deployment_id (redeploy) or project_id (fresh deploy)." };
    }

    if (!name) return { error: "Could not determine project name." };

    const body: Record<string, unknown> = {
      name,
      target,
      gitSource,
    };
    if (meta) body.meta = meta;
    // forceNew=1 tells Vercel to skip the build cache for this deployment.
    const params: Record<string, string> = { ...teamParam };
    if (forceNew) params.forceNew = "1";

    const data = await vercelRequest(token, "POST", "/v13/deployments", { params, body });
    return {
      ok: true,
      uid: data.uid ?? data.id,
      url: data.url,
      state: data.readyState ?? data.status,
      target: data.target,
      inspector_url: data.inspectorUrl,
      force_new: forceNew,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
