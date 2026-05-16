import type { TestPassScore } from "./types";

export function TestPassBadge({ score }: { score?: TestPassScore }) {
  if (!score) {
    return (
      <span className="rounded-full border border-border/40 bg-muted/20 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        TP --
      </span>
    );
  }

  const tone =
    score.fail > 0
      ? "bg-red-500/10 text-red-400 border-red-500/20"
      : score.score >= 90
        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        : "bg-[#E2B93B]/10 text-[#E2B93B] border-[#E2B93B]/20";

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone}`}
      title={`${score.pass} pass, ${score.fail} fail, ${score.total} total`}
    >
      TP {score.score}
    </span>
  );
}
