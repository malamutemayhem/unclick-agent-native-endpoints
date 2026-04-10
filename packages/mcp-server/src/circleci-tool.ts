// CircleCI CI/CD API.
// Docs: https://circleci.com/docs/api/v2/
// Auth: Circle-Token header
// Base: https://circleci.com/api/v2

const CIRCLECI_API_BASE = "https://circleci.com/api/v2";

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Get one at app.circleci.com/settings/user/tokens.");
  return key;
}

async function ccGet<T>(apiKey: string, path: string, query?: Record<string, string>): Promise<T> {
  const url = new URL(`${CIRCLECI_API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      "Circle-Token": apiKey,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? `HTTP ${res.status}`;
    throw new Error(`CircleCI error (${res.status}): ${msg}`);
  }
  return data as T;
}

async function ccPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${CIRCLECI_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Circle-Token": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? `HTTP ${res.status}`;
    throw new Error(`CircleCI error (${res.status}): ${msg}`);
  }
  return data as T;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function circleci_list_pipelines(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const slug = String(args.project_slug ?? "").trim();
  const query: Record<string, string> = {};
  if (args.page_token) query["page-token"] = String(args.page_token);
  if (args.branch) query.branch = String(args.branch);

  let path: string;
  if (slug) {
    path = `/project/${encodeURIComponent(slug)}/pipeline`;
  } else {
    path = "/pipeline";
    if (args.org_slug) query["org-slug"] = String(args.org_slug);
  }

  const data = await ccGet<{ items: unknown[]; next_page_token: string | null }>(apiKey, path, query);
  return {
    count: data.items.length,
    next_page_token: data.next_page_token ?? null,
    pipelines: data.items,
  };
}

export async function circleci_get_pipeline(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const id = String(args.pipeline_id ?? "").trim();
  if (!id) throw new Error("pipeline_id is required.");
  return ccGet<unknown>(apiKey, `/pipeline/${encodeURIComponent(id)}`);
}

export async function circleci_list_workflows(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const pipelineId = String(args.pipeline_id ?? "").trim();
  if (!pipelineId) throw new Error("pipeline_id is required.");

  const data = await ccGet<{ items: unknown[]; next_page_token: string | null }>(
    apiKey, `/pipeline/${encodeURIComponent(pipelineId)}/workflow`
  );
  return {
    count: data.items.length,
    next_page_token: data.next_page_token ?? null,
    workflows: data.items,
  };
}

export async function circleci_get_workflow(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const id = String(args.workflow_id ?? "").trim();
  if (!id) throw new Error("workflow_id is required.");
  return ccGet<unknown>(apiKey, `/workflow/${encodeURIComponent(id)}`);
}

export async function circleci_list_jobs(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const workflowId = String(args.workflow_id ?? "").trim();
  if (!workflowId) throw new Error("workflow_id is required.");

  const data = await ccGet<{ items: unknown[]; next_page_token: string | null }>(
    apiKey, `/workflow/${encodeURIComponent(workflowId)}/job`
  );
  return {
    count: data.items.length,
    next_page_token: data.next_page_token ?? null,
    jobs: data.items,
  };
}

export async function circleci_trigger_pipeline(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const slug = String(args.project_slug ?? "").trim();
  if (!slug) throw new Error("project_slug is required (e.g. gh/MyOrg/my-repo).");

  const body: Record<string, unknown> = {};
  if (args.branch) body.branch = String(args.branch);
  if (args.tag) body.tag = String(args.tag);
  if (args.parameters && typeof args.parameters === "object") body.parameters = args.parameters;

  const data = await ccPost<Record<string, unknown>>(
    apiKey, `/project/${encodeURIComponent(slug)}/pipeline`, body
  );
  return {
    id: data.id,
    number: data.number,
    state: data.state,
    created_at: data.created_at,
    raw: data,
  };
}
