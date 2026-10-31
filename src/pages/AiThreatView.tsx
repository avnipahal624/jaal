import { useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/panel";
import { formatClock } from "@/utils/formatters";
import { RefreshCw } from "lucide-react";
import { AI_TONE, useRunModule } from "./AiActionRunner";

const CATEGORY_LABELS: Record<string, string> = {
  SOCIAL_ENGINEERING: "Social engineering",
  PSYCHOLOGICAL_MANIPULATION: "Psychological manipulation",
  FINANCIAL_MANIPULATION: "Financial manipulation",
  INFORMATION_EXTRACTION: "Information extraction",
  CONVERSATION_BEHAVIOUR: "Conversation behaviour",
};

const CATEGORY_COLORS: Record<string, string> = {
  SOCIAL_ENGINEERING: "border-jamber/50 bg-jamber/10 text-jamber",
  PSYCHOLOGICAL_MANIPULATION: "border-jteal/50 bg-jteal/10 text-jteal",
  FINANCIAL_MANIPULATION: "border-jamber/50 bg-jamber/10 text-jamber",
  INFORMATION_EXTRACTION: "border-jcyan/50 bg-jcyan/10 text-jcyan",
  CONVERSATION_BEHAVIOUR: "border-jmuted/50 bg-jmuted/10 text-jmuted",
};

/** Grounded shape produced by `groundThreat` (see convex/lib/intelligenceSchemas.ts). */
interface MessageRef {
  messageId: string;
  quote: string;
  n: number;
}

interface ThreatFinding {
  id: string;
  category: string;
  tactic: string;
  severity: string;
  explanation: string;
  confidence: string;
  recommendedAction: string;
  limitations: string[];
  messageRefs: MessageRef[];
}

/** Four distinct colours — severity is never rendered in one flat tone. */
const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const SEVERITY_BAR: Record<string, string> = {
  CRITICAL: "bg-jred",
  HIGH: "bg-jred/60",
  MEDIUM: "bg-jamber",
  LOW: "bg-jgreen",
};
const SEVERITY_TEXT: Record<string, string> = {
  CRITICAL: "text-jred",
  HIGH: "text-jred",
  MEDIUM: "text-jamber",
  LOW: "text-jgreen",
};

function SeverityPill({ severity }: { severity: string }) {
  const tone =
    severity === "CRITICAL"
      ? "border-jred/50 bg-jred/10 text-jred"
      : severity === "HIGH"
        ? "border-jred/30 bg-jred/5 text-jred"
        : severity === "MEDIUM"
          ? "border-jamber/40 bg-jamber/10 text-jamber"
          : "border-jgreen/40 bg-jgreen/10 text-jgreen";
  return (
    <span className={`font-mono text-[8px] uppercase tracking-wider ${tone}`}>
      {severity}
    </span>
  );
}

export function ThreatView({ caseId }: { caseId: string }) {
  const navigate = useNavigate();
  const runModule = useRunModule();
  // Full stored row — includes the grounded `output` the list query omits.
  const current = useQuery(api.intelligence.getAnalysis, { caseId, module: "threat" });

  const run = async () => {
    await runModule("threat", caseId);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-jborder/50 px-3 py-2">
        <div>
          <h2 className="font-mono text-[12px] font-semibold text-jtext">Threat Intelligence Analyst</h2>
          <p className="font-mono text-[8px] uppercase tracking-widest text-jmuted/60">Module 1 · contextual threat read</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!current ? (
            <Button
              onClick={run}
              disabled={current === undefined}
              className="font-mono text-[10px] uppercase tracking-wider bg-jcyan text-background hover:bg-jcyan/85"
            >
              <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Analyse
            </Button>
          ) : current.status === "PROCESSING" ? (
            <Button variant="outline" disabled className="gap-1.5 font-mono text-[10px] uppercase tracking-wider text-jamber">
              <RefreshCw className="size-3 animate-spin" />
              Analysing
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-[10px] uppercase tracking-wider text-jcyan hover:bg-jcyan/10"
              onClick={run}
            >
              <RefreshCw className="size-3" />
              Reanalyse
            </Button>
          )}
        </div>
      </div>

      {current ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Status strip */}
          <div
            className="border-b border-jborder/40 px-3 py-2"
            style={{ scrollMarginTop: "2rem" }}
          >
            <div className="flex flex-wrap items-center gap-2">
              {current.status === "COMPLETED" ? (
                <Chip tone={AI_TONE.success} className="font-mono text-[9px] uppercase tracking-wider">
                  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12l2.5 2.5L16 6" />
                  </svg>
                  completed
                </Chip>
              ) : current.status === "PROCESSING" ? (
                <Chip tone={AI_TONE.warning} className="font-mono text-[9px] uppercase tracking-wider">
                  <RefreshCw className="size-3 animate-spin" />
                  processing
                </Chip>
              ) : current.status === "FAILED" ? (
                <Chip tone={AI_TONE.error} className="font-mono text-[9px] uppercase tracking-wider">
                  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-6 6M9 9l6 6" />
                  </svg>
                  failed
                </Chip>
              ) : current.status === "UNAVAILABLE" ? (
                <Chip tone={AI_TONE.attention} className="font-mono text-[9px] uppercase tracking-wider">
                  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
                  </svg>
                  unavailable
                </Chip>
              ) : (
                <Chip tone={AI_TONE.neutral} className="font-mono text-[9px] uppercase tracking-wider">
                  not started
                </Chip>
              )}
              {current.stale && current.status === "COMPLETED" && (
                <span className="font-mono text-[8px] uppercase tracking-widest text-jamber">stale</span>
              )}
              {current.provider && current.model && (
                <span className="font-mono text-[9px] text-jmuted/60">
                  {current.provider} · {current.model}
                </span>
              )}
              {current.error && current.status === "FAILED" && (
                <span className="font-mono text-[9px] uppercase tracking-wider text-jamber">{current.error}</span>
              )}
            </div>
            {current.limitations.length > 0 && (
              <p className="mt-1 font-mono text-[9px] leading-relaxed text-jmuted/70">{current.limitations[0]}</p>
            )}
            {current.inputMessageCount > 0 && (
              <span className="font-mono text-[8px] text-jmuted/40">
                from {current.inputMessageCount} message(s) · {formatClock(current.at)}
              </span>
            )}
          </div>

          {current.status === "COMPLETED" && current.output?.findings && current.output.findings.length > 0 ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
              {/* ---- Threat overview + severity distribution (§2.6) ---- */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                {current.output.overview && (
                  <div className="border border-jborder/50 bg-jsurface/40 p-3">
                    <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-jmuted/60">
                      Threat overview
                    </p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-jtext/90">
                      {current.output.overview}
                    </p>
                  </div>
                )}
                <div className="border border-jborder/50 bg-jsurface/40 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-jmuted/60">
                      Severity distribution
                    </p>
                    <span className="font-mono text-[10px] text-jtext">
                      {current.output.findings.length} total
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {SEVERITY_ORDER.map((level) => {
                      const n = current.output.findings.filter(
                        (f: ThreatFinding) => f.severity === level,
                      ).length;
                      const max = Math.max(
                        1,
                        ...SEVERITY_ORDER.map((l) =>
                          current.output.findings.filter(
                            (f: ThreatFinding) => f.severity === l,
                          ).length,
                        ),
                      );
                      return (
                        <div key={level} className="flex items-center gap-2">
                          <span
                            className={`w-[68px] shrink-0 font-mono text-[9px] uppercase tracking-wider ${SEVERITY_TEXT[level]}`}
                          >
                            {level}
                          </span>
                          <span className="h-1.5 flex-1 bg-jborder/40">
                            <span
                              className={`block h-full ${SEVERITY_BAR[level]}`}
                              style={{ width: `${(n / max) * 100}%` }}
                            />
                          </span>
                          <span className="w-4 shrink-0 text-right font-mono text-[10px] text-jtext">
                            {n}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {(Object.keys(CATEGORY_LABELS) as string[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className="font-mono text-[8px] uppercase tracking-wider border border-jborder/40 px-2.5 py-1 text-jmuted hover:border-jcyan/50 hover:text-jcyan"
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>

              {current.output.findings.map((f: ThreatFinding, i: number) => (
                <div
                  key={f.id}
                  className="border-b border-jborder/40 py-3 last:border-0 last:pb-0"
                  style={{ scrollMarginTop: "2rem" }}
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <span className="font-mono text-[8px] uppercase tracking-widest text-jmuted">
                      Finding #{String(i + 1).padStart(2, "0")}
                    </span>
                    <span className={`font-mono text-[9px] uppercase tracking-widest ${CATEGORY_COLORS[f.category ?? ""] ?? ""}`}>
                      {CATEGORY_LABELS[f.category ?? ""] ?? f.category}
                    </span>
                    <SeverityPill severity={f.severity} />
                    <Chip tone={AI_TONE.neutral} className="font-mono text-[8px] uppercase tracking-wider">
                      conf · {f.confidence}
                    </Chip>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-jtext/90">{f.explanation}</p>
                  {f.recommendedAction && (
                    <p className="mt-1 font-mono text-[9px] leading-relaxed text-jamber">
                      → {f.recommendedAction}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {f.messageRefs?.map((r: MessageRef) => (
                      <button
                        key={r.messageId}
                        type="button"
                        onClick={() => navigate(`/investigations/${caseId}/intelligence?msg=${r.n ?? ""}`)}
                        className="font-mono text-[9px] uppercase tracking-wider text-jcyan transition-colors hover:text-jcyan/60"
                      >
                        MSG #{r.n} · {r.quote?.slice(0, 60)}…
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {current.output?.insights && current.output.insights.length > 0 && (
                <div className="mt-3 border-t border-jborder/40 px-1">
                  <p className="font-mono text-[8px] uppercase tracking-widest text-jmuted/60">Patterns</p>
                  <ul className="mt-1 list-disc space-y-1 px-4">
                    {current.output.insights.map((s: string, i: number) => (
                      <li key={i} className="font-mono text-[9px] text-jmuted/80">{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {current.output?.recommendedSteps && current.output.recommendedSteps.length > 0 && (
                <div className="mt-2 border-t border-jborder/40 px-1">
                  <p className="font-mono text-[8px] uppercase tracking-widest text-jmuted/60">Recommended next steps</p>
                  <ul className="mt-1 list-disc space-y-1 px-4">
                    {current.output.recommendedSteps.map((s: string, i: number) => (
                      <li key={i} className="font-mono text-[9px] text-jmuted/80">{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : current.status === "COMPLETED" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-3 py-8 text-center">
              <svg className="size-10 text-jmuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L12 2.25l.813 2.846a4.5 4.5 0 003.09 3.09L18.75 12l-2.846.813a4.5 4.5 0 00-3.09-3.09zM12 6v.75m0 3h.75m-3 0h-.75" />
              </svg>
              <p className="font-mono text-[10px] uppercase tracking-widest text-jmuted">No findings</p>
              <p className="font-mono text-[9px] text-jmuted/60">
                {current.limitations?.[0] ?? "The conversation contains no manipulative cues."}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border-b border-jborder/40 px-3 py-6 text-center">
          <svg className="size-8 text-jmuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L12 2.25l.813 2.846a4.5 4.5 0 003.09 3.09L18.75 12l-2.846.813a4.5 4.5 0 00-3.09-3.09zM12 6v.75m0 3h.75m-3 0h-.75" />
          </svg>
          <p className="font-mono text-[10px] uppercase tracking-widest text-jmuted">No analysis yet</p>
          <p className="font-mono text-[9px] text-jmuted/60">
            {current === undefined ? "Waiting for the case to load…" : "Hit Analyse to read the conversation."}
          </p>
        </div>
      )}
    </div>
  );
}
