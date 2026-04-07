import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CATEGORIES,
  type Category,
  type CommunityTool,
  saveCommunityTool,
  TOOL_SUBMITTED_EVENT,
} from "@/lib/communityTools";

interface FormData {
  name: string;
  endpointUrl: string;
  description: string;
  category: Category | "";
  docsUrl: string;
  githubUrl: string;
}

type CheckStatus = "idle" | "checking" | "pass" | "close" | "fail";

interface HealthResult {
  status: CheckStatus;
  message: string;
  detail?: string;
  responseTime?: number;
}

async function checkHealth(url: string): Promise<HealthResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  const start = Date.now();

  try {
    let response: Response;

    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ ping: true }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      // CORS or network error - try no-cors to check basic reachability
      const nocorsStart = Date.now();
      try {
        await fetch(url, {
          method: "POST",
          mode: "no-cors",
          signal: controller.signal,
        });
        clearTimeout(timer);
        const rt = Date.now() - nocorsStart;
        return {
          status: "close",
          message: "Almost there",
          detail:
            "Your endpoint is reachable but CORS is blocking the health check. Add 'Access-Control-Allow-Origin: *' to your response headers so agents can call it.",
          responseTime: rt,
        };
      } catch (nocorsErr) {
        clearTimeout(timer);
        const isTimeout =
          (fetchErr as Error)?.name === "AbortError" ||
          (nocorsErr as Error)?.name === "AbortError";
        if (isTimeout) {
          return {
            status: "fail",
            message: "Couldn't reach your endpoint",
            detail:
              "Request timed out after 5 seconds. Make sure your server is running and publicly accessible.",
          };
        }
        return {
          status: "fail",
          message: "Couldn't reach your endpoint",
          detail: "Network error. Double-check the URL and make sure your server is live.",
        };
      }
    }

    clearTimeout(timer);
    const responseTime = Date.now() - start;

    if (responseTime > 5000) {
      return {
        status: "close",
        message: "Almost there",
        detail: `Endpoint responded in ${(responseTime / 1000).toFixed(1)}s. Aim for under 5 seconds.`,
        responseTime,
      };
    }

    if (!response.ok) {
      return {
        status: "close",
        message: "Almost there",
        detail: `Got HTTP ${response.status}. Your endpoint should return a 2xx status code.`,
        responseTime,
      };
    }

    const ct = response.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return {
        status: "close",
        message: "Almost there",
        detail: `Endpoint returned ${ct ? `"${ct}"` : "no content-type"} instead of JSON. Set Content-Type: application/json.`,
        responseTime,
      };
    }

    try {
      await response.json();
    } catch {
      return {
        status: "close",
        message: "Almost there",
        detail:
          "Response header says JSON but the body couldn't be parsed. Check for syntax errors in your response.",
        responseTime,
      };
    }

    return { status: "pass", message: "Your tool is live!", responseTime };
  } catch {
    clearTimeout(timer);
    return {
      status: "fail",
      message: "Couldn't reach your endpoint",
      detail: "Something went wrong. Check the URL and try again.",
    };
  }
}

const EMPTY_FORM: FormData = {
  name: "",
  endpointUrl: "",
  description: "",
  category: "",
  docsUrl: "",
  githubUrl: "",
};

const inputClass =
  "w-full rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm text-heading placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors";

const ToolSubmitForm = () => {
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [checkStatus, setCheckStatus] = useState<CheckStatus>("idle");
  const [result, setResult] = useState<HealthResult | null>(null);

  const set =
    (field: keyof FormData) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const canSubmit =
    form.name.trim() &&
    form.endpointUrl.trim() &&
    form.description.trim() &&
    form.category &&
    checkStatus !== "checking";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setCheckStatus("checking");
    setResult(null);

    const health = await checkHealth(form.endpointUrl.trim());
    setCheckStatus(health.status);
    setResult(health);

    if (health.status !== "fail") {
      const tool: CommunityTool = {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        endpointUrl: form.endpointUrl.trim(),
        description: form.description.trim(),
        category: form.category as Category,
        docsUrl: form.docsUrl.trim() || undefined,
        githubUrl: form.githubUrl.trim() || undefined,
        healthStatus: health.status === "pass" ? "live" : "under-review",
        submittedAt: new Date().toISOString(),
      };
      saveCommunityTool(tool);
      window.dispatchEvent(new CustomEvent(TOOL_SUBMITTED_EVENT));
    }
  };

  const reset = () => {
    setForm(EMPTY_FORM);
    setCheckStatus("idle");
    setResult(null);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-6 sm:p-8">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-heading mb-1.5">
              Tool name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={set("name")}
              placeholder="My Awesome Tool"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-heading mb-1.5">
              Endpoint URL
            </label>
            <input
              type="url"
              value={form.endpointUrl}
              onChange={set("endpointUrl")}
              placeholder="https://api.example.com/v1/tool"
              className={`${inputClass} font-mono`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-heading mb-1.5">
            Short description
          </label>
          <textarea
            value={form.description}
            onChange={set("description")}
            placeholder="One or two sentences. What does it do and who is it for?"
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-heading mb-1.5">
            Category
          </label>
          <select
            value={form.category}
            onChange={set("category")}
            className={inputClass}
            style={{ colorScheme: "dark" }}
          >
            <option value="" disabled>
              Pick one...
            </option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-heading mb-1.5">
              Docs URL{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <input
              type="url"
              value={form.docsUrl}
              onChange={set("docsUrl")}
              placeholder="https://docs.example.com"
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-heading mb-1.5">
              GitHub URL{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <input
              type="url"
              value={form.githubUrl}
              onChange={set("githubUrl")}
              placeholder="https://github.com/you/repo"
              className={`${inputClass} font-mono`}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <motion.button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={
              canSubmit
                ? {
                    scale: 1.03,
                    boxShadow: "0 0 30px 6px rgba(226,185,59,0.2)",
                  }
                : {}
            }
            whileTap={canSubmit ? { scale: 0.98 } : {}}
          >
            {checkStatus === "checking" ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Checking endpoint...
              </>
            ) : (
              "Submit"
            )}
          </motion.button>
          <span className="text-xs text-muted-foreground">
            We run a quick health check when you submit.
          </span>
        </div>
      </form>

      <AnimatePresence>
        {result && checkStatus !== "checking" && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-6 rounded-lg border p-5 ${
              checkStatus === "pass"
                ? "border-primary/30 bg-primary/5"
                : checkStatus === "close"
                  ? "border-yellow-500/30 bg-yellow-500/5"
                  : "border-red-500/30 bg-red-500/5"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`text-base leading-none mt-0.5 font-bold ${
                  checkStatus === "pass"
                    ? "text-primary"
                    : checkStatus === "close"
                      ? "text-yellow-400"
                      : "text-red-400"
                }`}
              >
                {checkStatus === "pass"
                  ? "✓"
                  : checkStatus === "close"
                    ? "!"
                    : "✕"}
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-heading">
                  {result.message}
                </p>
                {result.detail && (
                  <p className="mt-1 text-xs text-body leading-relaxed">
                    {result.detail}
                  </p>
                )}
                {result.responseTime != null && (
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {result.responseTime}ms response time
                  </p>
                )}

                {checkStatus === "pass" && (
                  <div className="mt-2 flex flex-wrap gap-4 items-center">
                    <a
                      href="#tools"
                      className="text-xs text-primary underline underline-offset-4 hover:opacity-80"
                    >
                      See it in the grid
                    </a>
                    <button
                      onClick={reset}
                      className="text-xs text-muted-foreground underline underline-offset-4 hover:text-body"
                    >
                      Submit another tool
                    </button>
                  </div>
                )}

                {checkStatus === "close" && (
                  <div className="mt-2 flex flex-wrap gap-4 items-center">
                    <p className="text-xs text-muted-foreground">
                      Added as "Under Review". Fix the issue and resubmit to go live.
                    </p>
                    <button
                      onClick={reset}
                      className="text-xs text-muted-foreground underline underline-offset-4 hover:text-body"
                    >
                      Resubmit
                    </button>
                  </div>
                )}

                {checkStatus === "fail" && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs font-medium text-heading">
                      Troubleshooting tips:
                    </p>
                    <ul className="text-xs text-body space-y-1 list-disc list-inside">
                      <li>Check the URL is correct and publicly accessible</li>
                      <li>Make sure your server is running</li>
                      <li>
                        Test it with curl:{" "}
                        <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-[10px]">
                          curl -X POST {form.endpointUrl || "<your-url>"}
                        </code>
                      </li>
                    </ul>
                    <button
                      onClick={reset}
                      className="mt-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-body"
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ToolSubmitForm;
