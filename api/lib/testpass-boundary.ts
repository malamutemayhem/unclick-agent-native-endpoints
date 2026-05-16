// API-facing TestPass boundary. Keep Vercel entrypoints off package internals
// while preserving the existing source-backed runtime until TestPass ships dist.
export { probeServer } from "../../packages/testpass/src/probe.js";
export {
  computeVerdictSummary,
  createEvidence,
  createRun,
  seedPendingItems,
  updateRunStatus,
} from "../../packages/testpass/src/run-manager.js";
export {
  generateHtmlReport,
  generateJsonReport,
  generateMarkdownFixList,
} from "../../packages/testpass/src/reporter.js";
export { runDeterministicChecks } from "../../packages/testpass/src/runner/deterministic.js";
export { runAgentChecks } from "../../packages/testpass/src/runner/agent.js";
export { runMultiPass } from "../../packages/testpass/src/runner/controller.js";
export { healFailedChecks } from "../../packages/testpass/src/runner/healer.js";
export { loadPackFromFile, loadPackFromYaml, packToJsonb } from "../../packages/testpass/src/pack-loader.js";
export type { RunProfile, RunTarget } from "../../packages/testpass/src/types.js";
