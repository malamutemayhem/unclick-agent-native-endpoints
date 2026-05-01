export async function apiFetchJson({
  apiBase,
  apiKey,
  action,
  method = "GET",
  body,
  query = {},
  timeoutMs = 10_000,
}) {
  const qs = new URLSearchParams({ action, ...query }).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiBase}/api/memory-admin?${qs}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`api ${action} -> ${res.status} ${text.slice(0, 200)}`);
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `api ${action} invalid json response: ${reason}${text ? ` body=${text.slice(0, 200)}` : ""}`
      );
    }
  } catch (err) {
    if (err && typeof err === "object" && err.name === "AbortError") {
      throw new Error(`api ${action} timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
