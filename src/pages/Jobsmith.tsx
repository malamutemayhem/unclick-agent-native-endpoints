import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Clipboard,
  FileText,
  Link as LinkIcon,
  ShieldCheck,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/FadeIn";
import { useCanonical } from "@/hooks/use-canonical";
import { useMetaTags } from "@/hooks/useMetaTags";

type ReadinessLevel = "blocked" | "review" | "ready";

interface JobsmithPublicDraft {
  company: string;
  role: string;
  jobSource: string;
  claim: string;
  proofNote: string;
}

interface ReadinessCheck {
  label: string;
  level: ReadinessLevel;
  reason: string;
}

const EMPTY_DRAFT: JobsmithPublicDraft = {
  company: "",
  role: "",
  jobSource: "",
  claim: "",
  proofNote: "",
};

const LEVEL_LABELS: Record<ReadinessLevel, string> = {
  blocked: "Blocked",
  review: "Review",
  ready: "Ready",
};

const LEVEL_STYLES: Record<ReadinessLevel, string> = {
  blocked: "border-rose-300/25 bg-rose-300/10 text-rose-100",
  review: "border-[#E2B93B]/30 bg-[#E2B93B]/10 text-[#F4D36B]",
  ready: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
};

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function valueOrDraft(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function hasBrittleFormatLanguage(value: string): boolean {
  return /\b(table|tables|column|columns|two-column|textbox|text box|image-only|pdf-only|scanned|screenshot|infographic|hidden text|keyword stuffing)\b/i.test(
    value,
  );
}

function hasLongPortalCopy(value: string): boolean {
  return value.trim().split(/\s+/).filter(Boolean).length > 55 || value.trim().length > 420;
}

function buildReadinessChecks(draft: JobsmithPublicDraft): ReadinessCheck[] {
  const roleBasicsReady = hasText(draft.company) && hasText(draft.role) && hasText(draft.jobSource);
  const claimReady = hasText(draft.claim);
  const proofReady = hasText(draft.proofNote);
  const combinedCopy = `${draft.claim}\n${draft.proofNote}\n${draft.jobSource}`;

  return [
    {
      label: "Role basics",
      level: roleBasicsReady ? "ready" : "blocked",
      reason: roleBasicsReady ? "Company, role, and job source are captured" : "Add company, role, and job source",
    },
    {
      label: "Source-backed claim",
      level: claimReady && proofReady ? "ready" : "blocked",
      reason: claimReady && proofReady ? "Claim has a proof note" : "Add one claim and one source or proof note",
    },
    {
      label: "Portal paste length",
      level: hasLongPortalCopy(draft.claim) ? "review" : "ready",
      reason: hasLongPortalCopy(draft.claim) ? "Shorten the claim before pasting into tight fields" : "Claim is short enough for starter portal copy",
    },
    {
      label: "Format risk",
      level: hasBrittleFormatLanguage(combinedCopy) ? "review" : "ready",
      reason: hasBrittleFormatLanguage(combinedCopy)
        ? "Review table, column, image, hidden text, or keyword-stuffing wording"
        : "No brittle ATS formatting language detected",
    },
  ];
}

function overallLevel(checks: ReadinessCheck[]): ReadinessLevel {
  if (checks.some((check) => check.level === "blocked")) return "blocked";
  if (checks.some((check) => check.level === "review")) return "review";
  return "ready";
}

function buildPacketText(draft: JobsmithPublicDraft, checks: ReadinessCheck[], level: ReadinessLevel): string {
  const blockers = checks.filter((check) => check.level === "blocked");
  const reviewItems = checks.filter((check) => check.level === "review");

  if (level === "blocked") {
    return [
      "Packet locked until Jobsmith has the role basics and one source-backed claim.",
      "",
      "Missing or blocked",
      ...blockers.map((check) => `- ${check.label}: ${check.reason}`),
    ].join("\n");
  }

  return [
    `Starter packet: ${valueOrDraft(draft.role, "Role")} at ${valueOrDraft(draft.company, "Company")}`,
    "",
    "Role source",
    `- Job source: ${valueOrDraft(draft.jobSource, "Not captured")}`,
    "",
    "Truth ledger",
    `- Claim: ${valueOrDraft(draft.claim, "Not drafted")}`,
    `- Claim proof: ${valueOrDraft(draft.proofNote, "Not captured")}`,
    "",
    "Paste readiness",
    `- Workday: ${level === "ready" ? "Ready for careful field-by-field paste" : "Review flagged copy first"}`,
    `- Greenhouse: ${level === "ready" ? "Ready for summary and cover-note paste" : "Use only reviewed clean copy"}`,
    `- Lever: ${level === "ready" ? "Ready for recruiter skim copy" : "Review before sending"}`,
    ...(reviewItems.length > 0 ? ["", "Review first", ...reviewItems.map((check) => `- ${check.label}: ${check.reason}`)] : []),
    "",
    "Trust note",
    "- This packet is assembled in the browser-local draft.",
    "- No application is submitted and no external check is called.",
  ].join("\n");
}

function LevelBadge({ level }: { level: ReadinessLevel }) {
  const Icon = level === "ready" ? CheckCircle2 : AlertTriangle;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${LEVEL_STYLES[level]}`}>
      <Icon className="h-3.5 w-3.5" />
      {LEVEL_LABELS[level]}
    </span>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-xs font-medium text-white/55">{label}</span>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#61C1C4]/45"
      />
    </label>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-xs font-medium text-white/55">{label}</span>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full resize-y rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#61C1C4]/45"
      />
    </label>
  );
}

export default function JobsmithPage() {
  const [draft, setDraft] = useState<JobsmithPublicDraft>(EMPTY_DRAFT);
  const [copied, setCopied] = useState(false);

  useCanonical("/jobsmith");
  useMetaTags({
    title: "Jobsmith - UnClick",
    description: "A browser-local Jobsmith tool for source-backed starter application packets.",
    ogTitle: "Jobsmith - UnClick",
    ogDescription: "Prepare a small source-backed application packet without login or external calls.",
    ogUrl: "https://unclick.world/jobsmith",
  });

  const checks = useMemo(() => buildReadinessChecks(draft), [draft]);
  const level = useMemo(() => overallLevel(checks), [checks]);
  const packetText = useMemo(() => buildPacketText(draft, checks, level), [checks, draft, level]);
  const blockers = checks.filter((check) => check.level === "blocked");

  function updateField<Key extends keyof JobsmithPublicDraft>(key: Key, value: JobsmithPublicDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setCopied(false);
  }

  async function copyPacket() {
    if (level === "blocked") return;
    await navigator.clipboard?.writeText(packetText);
    setCopied(true);
  }

  return (
    <div className="min-h-screen bg-[#090909] text-white">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-20 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#61C1C4]">Jobsmith</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Application packet builder</h1>
            </div>
            <div className="rounded-lg border border-[#61C1C4]/20 bg-[#61C1C4]/10 px-3 py-2 text-xs leading-5 text-[#9EE4E6]">
              Browser-local draft. No submit. No external check.
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.05}>
          <section
            aria-label="Jobsmith starter packet builder"
            className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]"
          >
            <div className="space-y-4">
              <section className="rounded-lg border border-white/[0.06] bg-[#111] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <BriefcaseBusiness className="h-4 w-4 text-[#61C1C4]" />
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">Role Basics</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="jobsmith-company"
                    label="Company"
                    value={draft.company}
                    onChange={(value) => updateField("company", value)}
                    placeholder="Example Studio"
                  />
                  <Field
                    id="jobsmith-role"
                    label="Role"
                    value={draft.role}
                    onChange={(value) => updateField("role", value)}
                    placeholder="Senior Product Designer"
                  />
                  <div className="sm:col-span-2">
                    <Field
                      id="jobsmith-job-source"
                      label="Job source"
                      value={draft.jobSource}
                      onChange={(value) => updateField("jobSource", value)}
                      placeholder="Job URL, referral note, or pasted source"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-white/[0.06] bg-[#111] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">Truth Ledger</h2>
                </div>
                <div className="grid gap-4">
                  <TextAreaField
                    id="jobsmith-claim"
                    label="Source-backed claim"
                    value={draft.claim}
                    onChange={(value) => updateField("claim", value)}
                    placeholder="One claim you could defend in an interview."
                  />
                  <TextAreaField
                    id="jobsmith-proof-note"
                    label="Source or proof note"
                    value={draft.proofNote}
                    onChange={(value) => updateField("proofNote", value)}
                    placeholder="Where that claim comes from, such as a CV line, portfolio project, or job evidence."
                  />
                </div>
              </section>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              <section
                aria-label="ATS and paste readiness"
                className="rounded-lg border border-white/[0.06] bg-[#111] p-5"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-[#E2B93B]" />
                    <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">Paste Readiness</h2>
                  </div>
                  <LevelBadge level={level} />
                </div>
                <div className="grid gap-2">
                  {checks.map((check) => (
                    <div key={check.label} className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{check.label}</p>
                        <LevelBadge level={check.level} />
                      </div>
                      <p className="mt-1 text-xs leading-5 text-white/50">{check.reason}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section aria-label="Starter packet" className="rounded-lg border border-white/[0.06] bg-[#111] p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-fuchsia-300" />
                    <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">Starter Packet</h2>
                  </div>
                  <LevelBadge level={level} />
                </div>

                {blockers.length > 0 && (
                  <div className="mb-4 rounded-lg border border-rose-300/20 bg-rose-300/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-100">Packet locked</p>
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-rose-100/75">
                      {blockers.map((blocker) => (
                        <li key={blocker.label}>{blocker.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <pre
                  data-testid="jobsmith-public-packet-copy"
                  className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-black/30 p-4 text-xs leading-5 text-white/70"
                >
                  {packetText}
                </pre>
                <div className="mt-4 rounded-lg border border-[#61C1C4]/15 bg-[#61C1C4]/[0.06] p-3 text-xs leading-5 text-[#9EE4E6]">
                  All data stays in this browser-local draft. Jobsmith does not submit an application from this page.
                </div>
                <button
                  type="button"
                  onClick={() => void copyPacket()}
                  disabled={level === "blocked"}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-fuchsia-300/30 bg-fuchsia-300/10 px-4 py-2.5 text-sm font-semibold text-fuchsia-100 transition-colors hover:bg-fuchsia-300/20 disabled:cursor-not-allowed disabled:border-white/[0.08] disabled:bg-white/[0.04] disabled:text-white/30"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy packet"}
                </button>
              </section>
            </aside>
          </section>
        </FadeIn>
      </main>
      <Footer />
    </div>
  );
}
