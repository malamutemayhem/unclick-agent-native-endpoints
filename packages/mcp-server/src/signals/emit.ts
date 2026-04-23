import { createClient } from "@supabase/supabase-js";

export type SignalInput = {
  apiKeyHash: string;
  tool: string;
  action: string;
  severity?: "info" | "action_needed" | "critical";
  summary: string;
  deepLink?: string;
  payload?: Record<string, unknown>;
};

function getServiceClient() {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
  return createClient(url, key);
}

export async function emitSignal(input: SignalInput): Promise<void> {
  try {
    if (!input.apiKeyHash || input.apiKeyHash === "unknown") return;
    const supabase = getServiceClient();
    await supabase.from("mc_signals").insert({
      api_key_hash: input.apiKeyHash,
      tool: input.tool,
      action: input.action,
      severity: input.severity ?? "info",
      summary: input.summary,
      deep_link: input.deepLink ?? null,
      payload: input.payload ?? {},
    });
  } catch {
    // fire-and-forget, never throws upstream
  }
}
