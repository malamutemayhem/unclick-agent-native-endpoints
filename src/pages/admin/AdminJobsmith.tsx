import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  FileText,
  Link as LinkIcon,
  MapPin,
  NotebookTabs,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type SourceMode = "url" | "paste" | "notes";
type SourceFactKey = "roleProof" | "skillProof" | "achievementProof" | "portfolioProof";
type ClaimKey = "openingHook" | "cvBullet" | "coverLetter" | "portalSummary";
type MaterialKey =
  | "masterCv"
  | "portfolioLinks"
  | "writingSamples"
  | "roleHistory"
  | "skills"
  | "notes";

interface JobsmithDraft {
  sourceMode: SourceMode;
  sourceUrl: string;
  pastedDescription: string;
  manualNotes: string;
  company: string;
  role: string;
  salary: string;
  location: string;
  closingDate: string;
  level: string;
  recruiter: string;
  source: string;
  atsVendor: string;
  materials: Record<MaterialKey, boolean>;
  sourceFacts: Record<SourceFactKey, string>;
  applicationClaims: Record<ClaimKey, string>;
  claimSources: Record<ClaimKey, SourceFactKey[]>;
}

const STORAGE_KEY = "unclick_jobsmith_phase1_capture_draft_v1";

const EMPTY_MATERIALS: Record<MaterialKey, boolean> = {
  masterCv: false,
  portfolioLinks: false,
  writingSamples: false,
  roleHistory: false,
  skills: false,
  notes: false,
};

const EMPTY_SOURCE_FACTS: Record<SourceFactKey, string> = {
  roleProof: "",
  skillProof: "",
  achievementProof: "",
  portfolioProof: "",
};

const EMPTY_APPLICATION_CLAIMS: Record<ClaimKey, string> = {
  openingHook: "",
  cvBullet: "",
  coverLetter: "",
  portalSummary: "",
};

const EMPTY_CLAIM_SOURCES: Record<ClaimKey, SourceFactKey[]> = {
  openingHook: [],
  cvBullet: [],
  coverLetter: [],
  portalSummary: [],
};

const DEFAULT_DRAFT: JobsmithDraft = {
  sourceMode: "url",
  sourceUrl: "",
  pastedDescription: "",
  manualNotes: "",
  company: "",
  role: "",
  salary: "",
  location: "",
  closingDate: "",
  level: "",
  recruiter: "",
  source: "",
  atsVendor: "",
  materials: EMPTY_MATERIALS,
  sourceFacts: EMPTY_SOURCE_FACTS,
  applicationClaims: EMPTY_APPLICATION_CLAIMS,
  claimSources: EMPTY_CLAIM_SOURCES,
};

const MATERIAL_LABELS: Record<MaterialKey, string> = {
  masterCv: "Master CV",
  portfolioLinks: "Portfolio links",
  writingSamples: "Writing samples",
  roleHistory: "Role history",
  skills: "Skills list",
  notes: "Notes",
};

const SOURCE_MODE_LABELS: Record<SourceMode, string> = {
  url: "URL",
  paste: "Paste",
  notes: "Notes",
};

const SOURCE_FACT_LABELS: Record<SourceFactKey, string> = {
  roleProof: "Role proof",
  skillProof: "Skill proof",
  achievementProof: "Achievement proof",
  portfolioProof: "Portfolio proof",
};

const CLAIM_LABELS: Record<ClaimKey, string> = {
  openingHook: "Opening hook",
  cvBullet: "CV bullet",
  coverLetter: "Cover letter paragraph",
  portalSummary: "Portal summary",
};

const REQUIRED_FIELDS: Array<keyof JobsmithDraft> = [
  "company",
  "role",
  "location",
  "level",
  "source",
  "atsVendor",
];

function loadDraft(): JobsmithDraft {
  if (typeof window === "undefined") return DEFAULT_DRAFT;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DRAFT;
    const parsed = JSON.parse(raw) as Partial<JobsmithDraft>;
    return {
      ...DEFAULT_DRAFT,
      ...parsed,
      materials: {
        ...EMPTY_MATERIALS,
        ...(parsed.materials ?? {}),
      },
      sourceFacts: {
        ...EMPTY_SOURCE_FACTS,
        ...(parsed.sourceFacts ?? {}),
      },
      applicationClaims: {
        ...EMPTY_APPLICATION_CLAIMS,
        ...(parsed.applicationClaims ?? {}),
      },
      claimSources: {
        ...EMPTY_CLAIM_SOURCES,
        ...(parsed.claimSources ?? {}),
      },
    };
  } catch {
    return DEFAULT_DRAFT;
  }
}

function textValue(value: string, fallback = "Not captured"): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

interface TruthLedgerEntry {
  key: ClaimKey;
  label: string;
  claim: string;
  sources: string[];
  status: "empty" | "blocked" | "ready";
  reason: string;
}

function buildTruthLedger(draft: JobsmithDraft): TruthLedgerEntry[] {
  return (Object.keys(CLAIM_LABELS) as ClaimKey[]).map((key) => {
    const claim = draft.applicationClaims[key].trim();
    const selectedSourceKeys = draft.claimSources[key] ?? [];
    const usableSourceKeys = selectedSourceKeys.filter((sourceKey) => draft.sourceFacts[sourceKey].trim().length > 0);

    if (claim.length === 0) {
      return {
        key,
        label: CLAIM_LABELS[key],
        claim,
        sources: [],
        status: "empty",
        reason: "Not drafted yet",
      };
    }

    if (selectedSourceKeys.length === 0) {
      return {
        key,
        label: CLAIM_LABELS[key],
        claim,
        sources: [],
        status: "blocked",
        reason: "Needs at least one source fact",
      };
    }

    if (usableSourceKeys.length !== selectedSourceKeys.length) {
      return {
        key,
        label: CLAIM_LABELS[key],
        claim,
        sources: usableSourceKeys.map((sourceKey) => SOURCE_FACT_LABELS[sourceKey]),
        status: "blocked",
        reason: "Selected source fact is empty",
      };
    }

    return {
      key,
      label: CLAIM_LABELS[key],
      claim,
      sources: usableSourceKeys.map((sourceKey) => SOURCE_FACT_LABELS[sourceKey]),
      status: "ready",
      reason: `${usableSourceKeys.length} source fact${usableSourceKeys.length === 1 ? "" : "s"} cited`,
    };
  });
}

function buildManualPlan(draft: JobsmithDraft): string {
  const materialList = (Object.entries(draft.materials) as Array<[MaterialKey, boolean]>)
    .filter(([, present]) => present)
    .map(([key]) => MATERIAL_LABELS[key]);
  const missingList = (Object.entries(draft.materials) as Array<[MaterialKey, boolean]>)
    .filter(([, present]) => !present)
    .map(([key]) => MATERIAL_LABELS[key]);
  const sourceFactLines = (Object.entries(draft.sourceFacts) as Array<[SourceFactKey, string]>).map(
    ([key, value]) => `- ${SOURCE_FACT_LABELS[key]}: ${textValue(value, "Needed")}`,
  );
  const ledger = buildTruthLedger(draft);
  const blockedClaims = ledger.filter((entry) => entry.status === "blocked");
  const ledgerLines = ledger.map((entry) => `- ${entry.label}: ${entry.status.toUpperCase()} - ${entry.reason}`);

  return [
    `Jobsmith capture: ${textValue(draft.role, "Role")} at ${textValue(draft.company, "Company")}`,
    "",
    "Role facts",
    `- Location: ${textValue(draft.location)}`,
    `- Salary: ${textValue(draft.salary)}`,
    `- Level: ${textValue(draft.level)}`,
    `- Closing date: ${textValue(draft.closingDate)}`,
    `- Recruiter: ${textValue(draft.recruiter)}`,
    `- Source: ${textValue(draft.source)}`,
    `- ATS vendor: ${textValue(draft.atsVendor)}`,
    "",
    "Source material",
    `- Ready: ${materialList.length > 0 ? materialList.join(", ") : "None yet"}`,
    `- Missing: ${missingList.length > 0 ? missingList.join(", ") : "None"}`,
    "",
    "Source facts",
    ...sourceFactLines,
    "",
    "Truth ledger",
    ...ledgerLines,
    `- Unsupported claims: ${blockedClaims.length > 0 ? blockedClaims.map((entry) => entry.label).join(", ") : "None"}`,
    "",
    "Manual tailoring plan",
    "- Pull only interview-defensible claims from source facts.",
    "- Copy only Ready claims into CV, cover letter, portal, or recruiter email.",
    "- Match role language to real skills and portfolio proof.",
    "- Reduce unnecessary age or over-seniority signals without hiding honest history.",
    "- Prepare ATS-safe CV, cover letter notes, portal copy, and recruiter email notes.",
    "- Stop before generation if a claim has no source fact.",
  ].join("\n");
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-xs font-medium text-white/55">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#61C1C4]/45"
      />
    </label>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-white/45">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

export default function AdminJobsmith() {
  const [draft, setDraft] = useState<JobsmithDraft>(() => loadDraft());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const requiredComplete = REQUIRED_FIELDS.filter((field) => {
    const value = draft[field];
    return typeof value === "string" && value.trim().length > 0;
  }).length;

  const sourceCaptured =
    (draft.sourceMode === "url" && draft.sourceUrl.trim().length > 0) ||
    (draft.sourceMode === "paste" && draft.pastedDescription.trim().length > 0) ||
    (draft.sourceMode === "notes" && draft.manualNotes.trim().length > 0);

  const materialsReady = Object.values(draft.materials).filter(Boolean).length;
  const ledger = useMemo(() => buildTruthLedger(draft), [draft]);
  const draftedClaims = ledger.filter((entry) => entry.status !== "empty").length;
  const readyClaims = ledger.filter((entry) => entry.status === "ready").length;
  const blockedClaims = ledger.filter((entry) => entry.status === "blocked").length;
  const truthStatus = blockedClaims > 0 ? `${blockedClaims} blocked` : draftedClaims > 0 ? `${readyClaims}/${draftedClaims} ready` : "No claims yet";
  const plan = useMemo(() => buildManualPlan(draft), [draft]);

  function updateField<K extends keyof JobsmithDraft>(field: K, value: JobsmithDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateClaimSource(claimKey: ClaimKey, sourceKey: SourceFactKey, checked: boolean) {
    const currentSources = draft.claimSources[claimKey] ?? [];
    const nextSources = checked
      ? [...currentSources.filter((key) => key !== sourceKey), sourceKey]
      : currentSources.filter((key) => key !== sourceKey);

    updateField("claimSources", {
      ...draft.claimSources,
      [claimKey]: nextSources,
    });
  }

  async function copyPlan() {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(plan);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#61C1C4]/10">
            <BriefcaseBusiness className="h-5 w-5 text-[#61C1C4]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Jobsmith</h1>
            <p className="text-sm text-white/50">Admin capture desk for real applications</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#61C1C4]/20 bg-[#61C1C4]/[0.05] px-3 py-2 text-xs font-medium text-[#61C1C4]">
          <Save className="h-4 w-4" />
          Draft saves locally
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <Metric icon={CheckCircle2} label="Required" value={`${requiredComplete}/${REQUIRED_FIELDS.length}`} />
        <Metric icon={LinkIcon} label="Source" value={sourceCaptured ? "Captured" : "Needed"} />
        <Metric icon={FileText} label="Materials" value={`${materialsReady}/6 ready`} />
        <Metric icon={ShieldCheck} label="Truth ledger" value={truthStatus} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-lg border border-white/[0.06] bg-[#111] p-5">
            <div className="mb-4 flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-[#61C1C4]" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">Job Source</h2>
            </div>
            <div className="mb-4 grid grid-cols-3 overflow-hidden rounded-lg border border-white/[0.08] bg-black/20 p-1">
              {(["url", "paste", "notes"] as SourceMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => updateField("sourceMode", mode)}
                  className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                    draft.sourceMode === mode
                      ? "bg-[#61C1C4]/15 text-[#61C1C4]"
                      : "text-white/45 hover:bg-white/[0.04] hover:text-white/70"
                  }`}
                >
                  {SOURCE_MODE_LABELS[mode]}
                </button>
              ))}
            </div>

            {draft.sourceMode === "url" && (
              <Field
                id="jobsmith-url"
                label="Job URL"
                value={draft.sourceUrl}
                onChange={(value) => updateField("sourceUrl", value)}
                placeholder="https://..."
                type="url"
              />
            )}
            {draft.sourceMode === "paste" && (
              <label htmlFor="jobsmith-paste" className="block">
                <span className="mb-1 block text-xs font-medium text-white/55">Pasted description</span>
                <textarea
                  id="jobsmith-paste"
                  value={draft.pastedDescription}
                  onChange={(event) => updateField("pastedDescription", event.target.value)}
                  rows={8}
                  className="w-full resize-y rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#61C1C4]/45"
                  placeholder="Paste the role description here."
                />
              </label>
            )}
            {draft.sourceMode === "notes" && (
              <label htmlFor="jobsmith-notes" className="block">
                <span className="mb-1 block text-xs font-medium text-white/55">Manual notes</span>
                <textarea
                  id="jobsmith-notes"
                  value={draft.manualNotes}
                  onChange={(event) => updateField("manualNotes", event.target.value)}
                  rows={6}
                  className="w-full resize-y rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#61C1C4]/45"
                  placeholder="Recruiter notes, pasted messages, or quick role context."
                />
              </label>
            )}
          </section>

          <section className="rounded-lg border border-white/[0.06] bg-[#111] p-5">
            <div className="mb-4 flex items-center gap-2">
              <BriefcaseBusiness className="h-4 w-4 text-[#E2B93B]" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">Role Facts</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="jobsmith-company" label="Company" value={draft.company} onChange={(value) => updateField("company", value)} />
              <Field id="jobsmith-role" label="Role" value={draft.role} onChange={(value) => updateField("role", value)} />
              <Field id="jobsmith-salary" label="Salary" value={draft.salary} onChange={(value) => updateField("salary", value)} />
              <Field id="jobsmith-location" label="Location" value={draft.location} onChange={(value) => updateField("location", value)} />
              <Field id="jobsmith-closing-date" label="Closing date" value={draft.closingDate} onChange={(value) => updateField("closingDate", value)} type="date" />
              <Field id="jobsmith-level" label="Level" value={draft.level} onChange={(value) => updateField("level", value)} placeholder="Senior, Lead, IC, contract" />
              <Field id="jobsmith-recruiter" label="Recruiter" value={draft.recruiter} onChange={(value) => updateField("recruiter", value)} />
              <Field id="jobsmith-source" label="Source" value={draft.source} onChange={(value) => updateField("source", value)} placeholder="LinkedIn, Seek, referral" />
              <Field id="jobsmith-ats" label="Likely ATS vendor" value={draft.atsVendor} onChange={(value) => updateField("atsVendor", value)} placeholder="Workday, Greenhouse, Lever, unknown" />
            </div>
          </section>

          <section className="rounded-lg border border-white/[0.06] bg-[#111] p-5">
            <div className="mb-4 flex items-center gap-2">
              <NotebookTabs className="h-4 w-4 text-fuchsia-300" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">Source Materials</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(MATERIAL_LABELS) as MaterialKey[]).map((key) => (
                <label
                  key={key}
                  htmlFor={`jobsmith-material-${key}`}
                  className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    draft.materials[key]
                      ? "border-[#61C1C4]/35 bg-[#61C1C4]/10 text-white"
                      : "border-white/[0.08] bg-black/20 text-white/55"
                  }`}
                >
                  <input
                    id={`jobsmith-material-${key}`}
                    type="checkbox"
                    checked={draft.materials[key]}
                    onChange={(event) =>
                      updateField("materials", {
                        ...draft.materials,
                        [key]: event.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-white/20 bg-black text-[#61C1C4]"
                  />
                  <span>{MATERIAL_LABELS[key]}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-white/[0.06] bg-[#111] p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">Source Facts</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {(Object.keys(SOURCE_FACT_LABELS) as SourceFactKey[]).map((key) => (
                <Field
                  key={key}
                  id={`jobsmith-source-fact-${key}`}
                  label={SOURCE_FACT_LABELS[key]}
                  value={draft.sourceFacts[key]}
                  onChange={(value) =>
                    updateField("sourceFacts", {
                      ...draft.sourceFacts,
                      [key]: value,
                    })
                  }
                  placeholder="Paste the exact proof or reference."
                />
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-white/[0.06] bg-[#111] p-5">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-[#61C1C4]" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">Application Claims</h2>
            </div>
            <div>
              {(Object.keys(CLAIM_LABELS) as ClaimKey[]).map((claimKey) => {
                const entry = ledger.find((item) => item.key === claimKey);
                const isBlocked = entry?.status === "blocked";
                const isReady = entry?.status === "ready";

                return (
                  <div key={claimKey} className="border-t border-white/[0.06] py-4 first:border-t-0 first:pt-0 last:pb-0">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor={`jobsmith-claim-${claimKey}`}
                        className="text-xs font-medium text-white/55"
                      >
                        {CLAIM_LABELS[claimKey]}
                      </label>
                      <span
                        aria-label={`Truth ledger status for ${CLAIM_LABELS[claimKey]}`}
                        data-testid="jobsmith-ledger-status"
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${
                          isReady
                            ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                            : isBlocked
                              ? "border-[#E2B93B]/30 bg-[#E2B93B]/10 text-[#E2B93B]"
                              : "border-white/[0.08] bg-black/20 text-white/45"
                        }`}
                      >
                        {isBlocked ? <AlertTriangle className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        {entry?.status === "empty" ? "Not drafted" : isReady ? "Ready" : "Blocked"}
                      </span>
                    </div>
                    <textarea
                      id={`jobsmith-claim-${claimKey}`}
                      value={draft.applicationClaims[claimKey]}
                      onChange={(event) =>
                        updateField("applicationClaims", {
                          ...draft.applicationClaims,
                          [claimKey]: event.target.value,
                        })
                      }
                      rows={2}
                      className="w-full resize-y rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#61C1C4]/45"
                      placeholder="Draft one claim, then cite its source facts."
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(Object.keys(SOURCE_FACT_LABELS) as SourceFactKey[]).map((sourceKey) => (
                        <label
                          key={sourceKey}
                          htmlFor={`jobsmith-claim-${claimKey}-source-${sourceKey}`}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                            draft.claimSources[claimKey]?.includes(sourceKey)
                              ? "border-[#61C1C4]/35 bg-[#61C1C4]/10 text-white"
                              : "border-white/[0.08] bg-black/20 text-white/55"
                          }`}
                        >
                          <input
                            id={`jobsmith-claim-${claimKey}-source-${sourceKey}`}
                            aria-label={`${CLAIM_LABELS[claimKey]} cites ${SOURCE_FACT_LABELS[sourceKey]}`}
                            type="checkbox"
                            checked={draft.claimSources[claimKey]?.includes(sourceKey) ?? false}
                            onChange={(event) => updateClaimSource(claimKey, sourceKey, event.target.checked)}
                            className="h-3.5 w-3.5 rounded border-white/20 bg-black text-[#61C1C4]"
                          />
                          <span>{SOURCE_FACT_LABELS[sourceKey]}</span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-white/45">{entry?.reason}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-lg border border-white/[0.06] bg-[#111] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Clipboard className="h-4 w-4 text-[#61C1C4]" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">Manual Plan</h2>
            </div>
            <div className="mb-4 grid gap-3">
              <div className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-black/20 p-3">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-[#61C1C4]" />
                <div>
                  <p className="text-sm font-semibold text-white">{textValue(draft.company, "Company")}</p>
                  <p className="text-xs text-white/45">{textValue(draft.role, "Role")}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-black/20 p-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#E2B93B]" />
                <div>
                  <p className="text-sm font-semibold text-white">{textValue(draft.location, "Location")}</p>
                  <p className="text-xs text-white/45">{textValue(draft.level, "Level")}</p>
                </div>
              </div>
            </div>
            <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-black/30 p-4 text-xs leading-5 text-white/70">
              {plan}
            </pre>
            <button
              type="button"
              onClick={() => void copyPlan()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-4 py-2.5 text-sm font-semibold text-[#61C1C4] transition-colors hover:bg-[#61C1C4]/20"
            >
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
              {copied ? "Copied" : "Copy plan"}
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
