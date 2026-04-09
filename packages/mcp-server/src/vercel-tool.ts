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

async function vercelGet(
  token: string,
  path: string,
  params?: Record<string, string>
): Promise<Record<string, unknown>> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`${VERCEL_BASE}${path}${qs}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) throw new Error("Invalid Vercel token.");
  if (res.status === 403) throw new Error("Vercel: access forbidden. Check token scopes.");
  if (res.status === 404) throw new Error(`Vercel: resource not found at ${path}.`);
  if (res.status === 429) throw new Error("Vercel rate limit exceeded.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vercel HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
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
