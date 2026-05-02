import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, ExternalLink } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import { useCanonical } from "@/hooks/use-canonical";
import { useMetaTags } from "@/hooks/useMetaTags";
import {
  dogfoodReport as fallbackReport,
  type DogfoodPassResult,
  type DogfoodStatus,
  type DogfoodStatusLegend,
  type DogfoodTrendPoint,
} from "@/data/dogfoodReport";

type DogfoodReportData = Omit<typeof fallbackReport, "results" | "trend"> & {
  results: DogfoodPassResult[];
  trend: DogfoodTrendPoint[];
  statusLegend: DogfoodStatusLegend;
  proofPolicy: string;
};

const STATUS_STYLES: Record<DogfoodStatus, { label: string; badge: string; icon: typeof CheckCircle2 }> = {
  passing: {
    label: "Passing",
    badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    icon: CheckCircle2,
  },
  failing: {
    label: "Needs action",
    badge: "border-red-400/20 bg-red-400/10 text-red-200",
    icon: AlertTriangle,
  },
  pending: {
    label: "Pending",
    badge: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    icon: Clock3,
  },
  blocked: {
    label: "Blocked",
    badge: "border-sky-400/25 bg-sky-400/10 text-sky-200",
    icon: AlertTriangle,
  },
};

function countByStatus(results: DogfoodPassResult[], status: DogfoodStatus): number {
  return results.filter((result) => result.status === status).length;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function proofTarget(result: DogfoodPassResult): string | null {
  return result.targetUrl || result.proof?.targetUrl || null;
}

export default function DogfoodReportPage() {
  const [report, setReport] = useState<DogfoodReportData>(fallbackReport);

  useCanonical("/dogfood");
  useMetaTags({
    title: "UnClick Dogfood Report - We Run UnClick on UnClick",
    description: "Public dogfood receipt for UnClick Pass-family checks running against UnClick itself.",
    ogTitle: "UnClick Dogfood Report",
    ogDescription: "We dogfood UnClick on UnClick. Public Pass-family quality receipts.",
    ogUrl: "https://unclick.world/dogfood",
  });

  useEffect(() => {
    fetch("/dogfood/latest.json", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : fallbackReport))
      .then((data: DogfoodReportData) => setReport(data))
      .catch(() => setReport(fallbackReport));
  }, []);

  const counts = useMemo(() => ({
    passing: countByStatus(report.results, "passing"),
    failing: countByStatus(report.results, "failing"),
    blocked: countByStatus(report.results, "blocked"),
    pending: countByStatus(report.results, "pending"),
  }), [report.results]);
  const receiptStatus = STATUS_STYLES[(report.status || "pending") as DogfoodStatus] || STATUS_STYLES.pending;
  const ReceiptIcon = receiptStatus.icon;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="px-6 pt-28 pb-16">
        <section className="mx-auto max-w-5xl">
          <FadeIn>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              <Activity className="h-3.5 w-3.5" />
              Public dogfood receipt
            </div>
          </FadeIn>

          <FadeIn delay={0.05}>
            <div className="mt-6 grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-heading sm:text-5xl">
                  {report.headline}
                </h1>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-body">
                  This page shows the latest Pass-family receipt evidence from checks running
                  against UnClick itself.
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-lg shadow-black/10">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-custom">
                  Latest receipt
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${receiptStatus.badge}`}>
                    <ReceiptIcon className="h-3.5 w-3.5" />
                    {receiptStatus.label}
                  </span>
                  <span className="text-xs text-muted-custom">{report.source}</span>
                </div>
                <p className="mt-3 text-sm text-heading">Last run: {formatDate(report.lastRunAt || report.generatedAt)}</p>
                <p className="mt-3 text-xs leading-relaxed text-body">{report.nextAutomation}</p>
              </div>
            </div>
          </FadeIn>
        </section>

        <section className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-4">
          {([
            ["Passing", counts.passing, "text-emerald-200"],
            ["Needs action", counts.failing, "text-red-200"],
            ["Blocked", counts.blocked, "text-sky-200"],
            ["Pending automation", counts.pending, "text-amber-200"],
          ] as const).map(([label, value, className]) => (
            <FadeIn key={label} delay={0.08}>
              <div className="rounded-2xl border border-border/70 bg-card/40 p-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-custom">{label}</p>
                <p className={`mt-2 text-4xl font-semibold ${className}`}>{value}</p>
              </div>
            </FadeIn>
          ))}
        </section>

        <section className="mx-auto mt-10 max-w-5xl">
          <FadeIn delay={0.1}>
            <div className="rounded-2xl border border-border/70 bg-card/40 p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-custom">
                Proof policy
              </p>
              <p className="mt-3 text-sm leading-relaxed text-body">{report.proofPolicy}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {(Object.keys(report.statusLegend) as DogfoodStatus[]).map((statusKey) => {
                  const status = STATUS_STYLES[statusKey];
                  const Icon = status.icon;

                  return (
                    <div key={statusKey} className="rounded-xl border border-border/50 bg-background/40 p-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${status.badge}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {status.label}
                      </span>
                      <p className="mt-2 text-xs leading-relaxed text-muted-custom">
                        {report.statusLegend[statusKey]}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </FadeIn>
        </section>

        <section className="mx-auto mt-10 max-w-5xl">
          <div className="grid gap-4 md:grid-cols-2">
            {report.results.map((result, index) => {
              const status = STATUS_STYLES[result.status];
              const Icon = status.icon;

              return (
                <FadeIn key={result.id} delay={0.04 * index}>
                  <article className="h-full rounded-2xl border border-border/70 bg-card/40 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-heading">{result.name}</h2>
                        <p className="mt-2 text-sm leading-relaxed text-body">{result.summary}</p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${status.badge}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-4 rounded-xl border border-border/50 bg-background/40 p-3 text-xs leading-relaxed text-muted-custom">
                      {result.evidence}
                    </p>
                    {result.blockedReason ? (
                      <p className="mt-3 text-xs leading-relaxed text-sky-200">
                        Blocked reason: {result.blockedReason}
                      </p>
                    ) : null}
                    {result.checkedAt ? (
                      <p className="mt-3 text-[11px] text-muted-custom">Checked: {formatDate(result.checkedAt)}</p>
                    ) : null}
                    {result.runId || result.targetUrl ? (
                      <div className="mt-3 space-y-1 text-[11px] text-muted-custom">
                        {result.runId ? <p>Run: {result.runId}</p> : null}
                        {result.targetUrl ? <p className="break-all">Target: {result.targetUrl}</p> : null}
                      </div>
                    ) : null}
                    {proofTarget(result) ? (
                      <a
                        href={proofTarget(result) || undefined}
                        className="mt-3 inline-flex items-center gap-1.5 break-all text-[11px] font-medium text-primary transition-opacity hover:opacity-80"
                      >
                        View proof target
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : null}
                  </article>
                </FadeIn>
              );
            })}
          </div>
        </section>

        <section className="mx-auto mt-10 grid max-w-5xl gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <FadeIn>
            <div className="rounded-2xl border border-border/70 bg-card/40 p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-custom">
                Last actionable failure
              </p>
              <h2 className="mt-3 text-lg font-semibold text-heading">{report.lastActionableFailure.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-body">{report.lastActionableFailure.detail}</p>
              <p className="mt-4 text-xs text-muted-custom">Owner: {report.lastActionableFailure.owner}</p>
            </div>
          </FadeIn>

          <FadeIn delay={0.05}>
            <div className="rounded-2xl border border-border/70 bg-card/40 p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-custom">Receipt trend</p>
              <div className="mt-4 overflow-x-auto rounded-xl border border-border/60">
                {report.trend.map((point) => (
                  <div key={point.date} className="grid min-w-[460px] grid-cols-5 gap-2 border-b border-border/50 px-4 py-3 text-xs last:border-b-0">
                    <span className="text-heading">{point.date}</span>
                    <span className="text-emerald-200">Pass {point.passing}</span>
                    <span className="text-red-200">Fail {point.failing}</span>
                    <span className="text-sky-200">Blocked {point.blocked || 0}</span>
                    <span className="text-amber-200">Pending {point.pending}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </section>

        <section className="mx-auto mt-10 max-w-5xl">
          <a
            href="/dogfood/latest.json"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-opacity hover:opacity-80"
          >
            View public JSON receipt
            <ExternalLink className="h-4 w-4" />
          </a>
        </section>
      </main>

      <Footer />
    </div>
  );
}
