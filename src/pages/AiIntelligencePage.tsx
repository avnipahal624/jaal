import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { api } from "@/convex/_generated/api";
import {
  Brain,
  Activity,
  MessageSquare,
  Link2,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/panel";
import { formatDateTime } from "@/utils/formatters";
import { AI_TONE } from "./AiActionRunner";
import { ThreatView } from "./AiThreatView";
import { PredictionView } from "./AiPredictionView";
import { CopilotView } from "./AiCopilotView";
import { CorrelationView } from "./AiCorrelationView";
import { ReportView } from "./AiReportView";

export interface AiAnalysis {
  module: string;
  status: "NOT_STARTED" | "PROCESSING" | "COMPLETED" | "FAILED" | "UNAVAILABLE";
  at: number;
  fingerprint: string;
  stale: boolean;
  inputMessageCount: number;
  provider: string | null;
  model: string | null;
  limitations: string[];
  error: string | null;
  durationMs: number | null;
}

const MODULES = [
  {
    key: "threat",
    label: "Threat Intelligence Analyst",
    desc: "AI analyses conversations to identify manipulative behaviour, scam patterns and potential threats.",
    icon: Brain,
    color: "text-jred",
    accent: "border-jred/40",
    bg: "bg-jred/5",
    action: "View analysis",
  },
  {
    key: "prediction",
    label: "Behaviour Prediction Engine",
    desc: "Predicts possible next actions and escalation patterns based on current conversation context.",
    icon: Activity,
    color: "text-jamber",
    accent: "border-jamber/40",
    bg: "bg-jamber/5",
    action: "View predictions",
  },
  {
    key: "copilot",
    label: "Investigation Copilot",
    desc: "Ask questions about the case, evidence and findings. Get contextual, grounded answers from your investigation.",
    icon: MessageSquare,
    color: "text-jcyan",
    accent: "border-jcyan/40",
    bg: "bg-jcyan/5",
    action: "Open copilot",
  },
  {
    key: "correlation",
    label: "Evidence Correlation Engine",
    desc: "Finds potential relationships between indicators, messages and evidence. Suggests new connections for review.",
    icon: Link2,
    color: "text-jteal",
    accent: "border-jteal/40",
    bg: "bg-jteal/5",
    action: "View suggestions",
  },
  {
    key: "report",
    label: "Forensic Report Assistant",
    desc: "Generates structured, evidence-backed reports with clear separation of facts, AI insights and recommendations.",
    icon: FileText,
    color: "text-jgreen",
    accent: "border-jgreen/40",
    bg: "bg-jgreen/5",
    action: "Generate report",
  },
] as const;

type ModuleKey = (typeof MODULES)[number]["key"];

const STATUS_LABEL: Record<AiAnalysis["status"], string> = {
  NOT_STARTED: "Not started",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  FAILED: "Failed",
  UNAVAILABLE: "Unavailable",
};

function StatusChip({ status }: { status: AiAnalysis["status"] }) {
  const tone =
    status === "COMPLETED"
      ? AI_TONE.success
      : status === "PROCESSING"
        ? AI_TONE.warning
        : status === "FAILED"
          ? AI_TONE.error
          : status === "UNAVAILABLE"
            ? AI_TONE.attention
            : AI_TONE.neutral;
  return (
    <Chip tone={tone} className="font-mono text-[8px] uppercase tracking-wider">
      {status === "PROCESSING" ? (
        <Loader2 className="size-2.5 animate-spin" />
      ) : status === "COMPLETED" ? (
        <CheckCircle2 className="size-2.5" />
      ) : status === "FAILED" ? (
        <XCircle className="size-2.5" />
      ) : status === "UNAVAILABLE" ? (
        <Clock className="size-2.5" />
      ) : null}
      {STATUS_LABEL[status]}
    </Chip>
  );
}

/** Readiness gauge — completed modules over the five in the engine. */
function ReadinessGauge({ completed, total }: { completed: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const r = 34;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="relative size-[86px] shrink-0">
      <svg viewBox="0 0 80 80" className="size-full -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="var(--color-jborder)"
          strokeWidth="7"
        />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="var(--color-jcyan)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[18px] font-bold leading-none text-jtext">
          {pct}%
        </span>
        <span className="mt-1 font-mono text-[7px] uppercase tracking-[0.14em] text-jmuted">
          readiness
        </span>
      </div>
    </div>
  );
}

export function IntelligenceHub({
  caseId,
  analyses,
  suggestions,
  activity,
}: {
  caseId: string;
  analyses: AiAnalysis[];
  suggestions: { pending: number; total: number; confirmed: number } | null;
  activity: { at: number; module: string; detail: string }[];
}) {
  const [active, setActive] = useState<ModuleKey | null>(null);

  const rows = useMemo(
    () =>
      MODULES.map((m) => ({
        ...m,
        state: analyses.find((a) => a.module === m.key) ?? null,
      })),
    [analyses],
  );

  const completed = rows.filter((r) => r.state?.status === "COMPLETED").length;
  const failed = rows.filter((r) => r.state?.status === "FAILED").length;
  const metrics: [string, string | number][] = [
    ["Total modules", MODULES.length],
    ["Completed", completed],
    ["Pending review", suggestions?.pending ?? 0],
    ["Failed", failed],
  ];

  const open = active !== null;
  const activeMeta = open ? MODULES.find((m) => m.key === active) : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* ======================= PAGE HEADER ======================= */}
      <div className="border-b border-jborder/50 px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-bold leading-tight text-jtext">
              AI Intelligence
            </h1>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-jmuted">
              Advanced AI-powered insights for deeper investigation, better
              decisions and stronger outcomes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {suggestions && suggestions.pending > 0 && (
              <Chip
                tone={AI_TONE.warning}
                className="font-mono text-[9px] uppercase tracking-wider"
              >
                {suggestions.pending} pending review
              </Chip>
            )}
            <Chip
              tone={AI_TONE.attention}
              className="font-mono text-[9px] uppercase tracking-wider"
            >
              <Sparkles className="size-2.5" />
              {MODULES.length}-module engine
            </Chip>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* ======================= MODULE CARDS ======================= */}
        <section className="px-4 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {rows.map((m) => {
              const ran = m.state !== null && m.state.at > 0;
              return (
                <article
                  key={m.key}
                  className="flex flex-col border border-jborder/50 bg-jsurface/40 p-3 transition-colors hover:border-jcyan/50"
                >
                  <span
                    className={`flex size-8 items-center justify-center rounded-md border ${m.accent} ${m.bg}`}
                  >
                    <m.icon className={`size-4 ${m.color}`} />
                  </span>
                  <h2 className="mt-2.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-jtext">
                    {m.label}
                  </h2>
                  <p className="mt-1.5 flex-1 text-[11px] leading-relaxed text-jmuted">
                    {m.desc}
                  </p>
                  <div className="mt-3 border-t border-jborder/40 pt-2">
                    <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-jmuted/60">
                      {m.key === "copilot" ? "Last active" : "Last analysed"}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-jtext/85">
                        {ran ? formatDateTime(m.state!.at) : "—"}
                      </span>
                      <StatusChip status={m.state?.status ?? "NOT_STARTED"} />
                    </div>
                    {m.state?.stale && m.state.status === "COMPLETED" && (
                      <p className="mt-1 font-mono text-[8px] uppercase tracking-widest text-jamber">
                        source conversation changed
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2.5 w-full justify-between font-mono text-[10px] uppercase tracking-wider text-jcyan hover:border-jcyan/60 hover:bg-jcyan/10"
                    onClick={() => setActive(m.key)}
                  >
                    {m.action}
                    <ChevronRight className="size-3" />
                  </Button>
                </article>
              );
            })}
          </div>
        </section>

        {/* ======================= OVERVIEW + ACTIVITY ======================= */}
        <section className="grid gap-3 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="border border-jborder/50 bg-jsurface/40 p-4">
            <h2 className="font-mono text-[12px] font-semibold text-jtext">
              AI Intelligence Overview
            </h2>
            <p className="mt-1 text-[11px] text-jmuted">
              Quick summary of all AI modules for this investigation.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-6">
              <div className="flex flex-wrap gap-3">
                {metrics.map(([label, value]) => (
                  <div
                    key={label}
                    className="min-w-[104px] border border-jborder/50 bg-jpanel px-3 py-2.5"
                  >
                    <p className="font-mono text-[22px] font-bold leading-none text-jtext">
                      {value}
                    </p>
                    <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-jmuted">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="ml-auto">
                <ReadinessGauge completed={completed} total={MODULES.length} />
              </div>
            </div>

            <div className="mt-4 grid gap-3 border-t border-jborder/40 pt-3 sm:grid-cols-3">
              <div>
                <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-jmuted/60">
                  Messages analysed
                </p>
                <p className="mt-1 font-mono text-[13px] text-jtext">
                  {analyses[0]?.inputMessageCount ?? "—"}
                </p>
              </div>
              <div>
                <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-jmuted/60">
                  Confirmed relationships
                </p>
                <p className="mt-1 font-mono text-[13px] text-jtext">
                  {suggestions?.confirmed ?? "—"}
                </p>
              </div>
              <div>
                <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-jmuted/60">
                  Failed modules
                </p>
                <p
                  className={`mt-1 font-mono text-[13px] ${
                    failed > 0 ? "text-jred" : "text-jtext"
                  }`}
                >
                  {failed}
                </p>
              </div>
            </div>
          </div>

          <div className="border border-jborder/50 bg-jsurface/40 p-4">
            <h2 className="font-mono text-[12px] font-semibold text-jtext">
              Recent AI activity
            </h2>
            <div className="mt-3 space-y-2">
              {activity.length === 0 ? (
                <p className="text-[11px] leading-relaxed text-jmuted">
                  No AI module has run on this investigation yet. Open a module
                  above and trigger its analysis.
                </p>
              ) : (
                activity.map((a, i) => (
                  <div
                    key={`${a.module}-${a.at}-${i}`}
                    className="flex items-start gap-3 border-b border-jborder/30 pb-2 last:border-0 last:pb-0"
                  >
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-jcyan" />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-jtext">
                        {a.module}
                      </p>
                      <p className="truncate text-[11px] text-jmuted">
                        {a.detail}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[9px] text-jmuted/60">
                      {a.at ? formatDateTime(a.at) : "—"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ======================= MODULE WORKSPACE ======================= */}
        <section className="border-t border-jborder/50">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 font-mono text-[10px] uppercase tracking-wider text-jmuted hover:text-jcyan"
              onClick={() => setActive(null)}
            >
              <ArrowLeft className="size-3" />
              All modules
            </Button>
            <span className="font-mono text-[10px] uppercase tracking-widest text-jtext">
              {activeMeta?.label ?? ""}
            </span>
            {activeMeta && (
              <span className="truncate font-mono text-[9px] text-jmuted/60">
                case {caseId}
              </span>
            )}
          </div>

          <div className="flex min-h-[420px] flex-col">
            {active === "threat" && <ThreatView caseId={caseId} />}
            {active === "prediction" && <PredictionView caseId={caseId} />}
            {active === "copilot" && <CopilotView caseId={caseId} />}
            {active === "correlation" && (
              <CorrelationView
                caseId={caseId}
                suggestions={
                  suggestions
                    ? { pending: suggestions.pending, total: suggestions.total }
                    : null
                }
              />
            )}
            {active === "report" && <ReportView caseId={caseId} />}
            {!open && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                <Sparkles className="size-6 text-jcyan/50" />
                <p className="font-mono text-[11px] uppercase tracking-widest text-jmuted">
                  Select a module to open its workspace
                </p>
                <p className="max-w-md text-[11px] leading-relaxed text-jmuted/70">
                  Each module runs on your own case data, stores its result
                  separately from the evidence, and stays labelled until an
                  investigator reviews it.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function AiIntelligencePage() {
  const { id } = useParams<{ id: string }>();
  const caseId = id ?? "";

  const analysisData = useQuery(api.intelligence.analyses, { caseId });
  const suggestionData = useQuery(api.intelligence.suggestions, { caseId });
  const copilotTurns = useQuery(api.intelligence.copilotHistory, { caseId });

  const analyses: AiAnalysis[] = useMemo(
    () => analysisData?.analyses ?? [],
    [analysisData],
  );

  const suggestions = useMemo(() => {
    if (!analysisData || !suggestionData) return null;
    const pending = suggestionData.suggestions.filter(
      (s) => s.status === "PENDING_REVIEW",
    ).length;
    return {
      pending,
      total: suggestionData.suggestions.length,
      confirmed: suggestionData.confirmedCount,
    };
  }, [analysisData, suggestionData]);

  /** Real, reverse-chronological events derived from stored records only. */
  const activity = useMemo(() => {
    const label: Record<string, string> = {
      threat: "Threat Intelligence Analyst",
      prediction: "Behaviour Prediction Engine",
      correlation: "Evidence Correlation Engine",
      report: "Forensic Report Assistant",
    };
    const events: { at: number; module: string; detail: string }[] = [];

    for (const a of analyses) {
      if (a.status === "COMPLETED" && a.at > 0) {
        events.push({
          at: a.at,
          module: label[a.module] ?? a.module,
          detail:
            a.module === "report"
              ? "Report narrative generated"
              : a.module === "correlation"
                ? "Relationship suggestions generated"
                : a.module === "prediction"
                  ? "Prediction set generated"
                  : "Analysis completed",
        });
      } else if (a.status === "FAILED" && a.at > 0) {
        events.push({
          at: a.at,
          module: label[a.module] ?? a.module,
          detail: `Failed — ${a.error ?? "provider error"}`,
        });
      } else if (a.status === "UNAVAILABLE" && a.at > 0) {
        events.push({
          at: a.at,
          module: label[a.module] ?? a.module,
          detail: "Provider unavailable",
        });
      }
    }

    if (suggestionData) {
      const pending = suggestionData.suggestions.filter(
        (s) => s.status === "PENDING_REVIEW",
      ).length;
      const reviewed = suggestionData.suggestions.filter(
        (s) => s.status !== "PENDING_REVIEW" && s.reviewedAt,
      );
      if (pending > 0) {
        const newest = Math.max(
          0,
          ...suggestionData.suggestions
            .filter((s) => s.status === "PENDING_REVIEW")
            .map((s) => s.at),
        );
        events.push({
          at: newest,
          module: "Evidence Correlation Engine",
          detail: `${pending} suggestion${pending === 1 ? "" : "s"} awaiting review`,
        });
      }
      for (const s of reviewed.slice(0, 3)) {
        events.push({
          at: s.reviewedAt ?? s.at,
          module: "Evidence Correlation Engine",
          detail: `Suggestion ${s.status === "ACCEPTED" ? "accepted" : "rejected"} — ${s.source?.label ?? "entity"} → ${s.target?.label ?? "entity"}`,
        });
      }
    }

    if (Array.isArray(copilotTurns)) {
      const last = [...copilotTurns]
        .reverse()
        .find((t) => t.role === "user" && t.status !== "error");
      if (last) {
        events.push({
          at: last.at,
          module: "Investigation Copilot",
          detail: `Answered: "${last.content.slice(0, 70)}${last.content.length > 70 ? "…" : ""}"`,
        });
      }
    }

    return events.sort((a, b) => b.at - a.at).slice(0, 8);
  }, [analyses, suggestionData, copilotTurns]);

  return (
    <IntelligenceHub
      caseId={caseId}
      analyses={analyses}
      suggestions={suggestions}
      activity={activity}
    />
  );
}
