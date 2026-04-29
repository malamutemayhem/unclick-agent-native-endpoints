import type { SeoPassPack } from "./schema.js";

export interface LighthousePluginPlan {
  runner: "lighthouse";
  target_url: string;
  strategy: "mobile" | "desktop";
  categories: string[];
  output: ["json"];
  notes: string[];
}

export function buildLighthousePlan(pack: SeoPassPack): LighthousePluginPlan {
  return {
    runner: "lighthouse",
    target_url: pack.url,
    strategy: pack.lighthouse.strategy,
    categories: pack.lighthouse.categories,
    output: ["json"],
    notes: [
      "Chunk 1 scaffold only: this builds the Lighthouse execution plan.",
      "A later chip will execute Lighthouse, persist runs, and emit findings.",
    ],
  };
}
