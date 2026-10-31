import { useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/panel";
import { formatClock } from "@/utils/formatters";
import { AI_TONE, useRunModule } from "./AiActionRunner";

const CATEGORY_LABELS: Record<string, string> = {
  MONEY_REQUEST: "Money request",
  OTP_REQUEST: "OTP request",
  IDENTITY_DOCUMENT: "Identity document",
  SUSPICIOUS_LINK: "Suspicious link",
  LEGAL_THREAT: "Legal threat",
  URGENCY_ESCALATION: "Urgency escalation",
  NEW_AUTHORITY: "New authority",
  REMOTE_ACCESS: "Remote access",
  CREDENTIAL_THEFT: "Credential theft",
  REPETITION: "Repetition",
  OTHER: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  MONEY_REQUEST: "border-jamber/50 bg-jamber/10 text-jamber",
  OTP_REQUEST: "border-jamber/50 bg-jamber/10 text-jamber",
  IDENTITY_DOCUMENT: "border-jcyan/50 bg-jcyan/10 text-jcyan",
  SUSPICIOUS_LINK: "border-jamber/50 bg-jamber/10 text-jamber",
  LEGAL_THREAT: "border-jred/50 bg-jred/10 text-jred",
  URGENCY_ESCALATION: "border-jamber/50 bg-jamber/10 text-jamber",
  NEW_AUTHORITY: "border-jteal/50 bg-jteal/10 text-jteal",
  REMOTE_ACCESS: "border-jamber/50 bg-jamber/10 text-jamber",
  CREDENTIAL_THEFT: "border-jred/50 bg-jred/10 text-jred",
  REPETITION: "border-jmuted/50 bg-jmuted/10 text-jmuted",
  OTHER: "border-jmuted/50 bg-jmuted/10 text-jmuted",
};

/** Grounded shape produced by `groundPrediction` (see convex/lib/intelligenceSchemas.ts). */
interface MessageRef {
  messageId: string;
  quote: string;
  n: number;
}

interface Prediction {
  id: string;
  action: string;
  category: string;
  explanation: string;
  confidence: string;
  risk: string;
  suggestedResponse: string;
  uncertainty: string;
  messageRefs: MessageRef[];
}

interface PredictionIndicator {
  label: string;
  level: string;
}

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

export function PredictionView({ caseId }: { caseId: string }) {
  const navigate = useNavigate();
  const runModule = useRunModule();
  // Full stored row — includes the grounded `output` the list query omits.
  const current = useQuery(api.intelligence.getAnalysis, { caseId, module: "prediction" });

  const run = async () => {
    await runModule("prediction", caseId);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-jborder/50 px-3 py-2">
        <div>
          <h2 className="font-mono text-[12px] font-semibold text-jtext">Behaviour Prediction Engine</h2>
          <p className="font-mono text-[8px] uppercase tracking-widest text-jmuted/60">Module 2 · possible next moves</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!current ? (
            <Button
              onClick={run}
              disabled={current === undefined}
              className="font-mono text-[10px] uppercase tracking-wider bg-jamber text-background hover:bg-jamber/85"
            >
              <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Forecast
            </Button>
          ) : current.status === "PROCESSING" ? (
            <Button variant="outline" disabled className="gap-1.5 font-mono text-[10px] uppercase tracking-wider text-jamber">
              <svg className="size-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              Forecasting
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-[10px] uppercase tracking-wider text-jamber hover:bg-jamber/10"
              onClick={run}
            >
              <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.5m4.5-2.5l4.5 4.5M4 20v-5h.5m4.5-2.5l4.5 4.5M4 4l3.5 3.5M4 12l3.5 3.5" />
              </svg>
              Refresh
            </Button>
          )}
        </div>
      </div>

      {current ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-jborder/40 px-3 py-2" style={{ scrollMarginTop: "2rem" }}>
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
                  <svg className="size-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
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

          {current.status === "COMPLETED" && current.output?.predictions && current.output.predictions.length > 0 ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
              <div className="mb-2 flex flex-wrap gap-2">
                <Chip tone={AI_TONE.neutral} className="font-mono text-[9px] uppercase tracking-wider">
                  PREDICTIONS · not observed events
                </Chip>
                {current.output.insufficientInformation && (
                  <Chip tone={AI_TONE.neutral} className="font-mono text-[9px] uppercase tracking-wider">
                    insufficient information
                  </Chip>
                )}
              </div>

              {current.output.predictions[0] && (
                <div className="mb-3 border border-jred/40 bg-jred/5 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-jred px-2 py-0.5 font-mono text-[8px] uppercase tracking-widest text-background">
                      Most likely next action
                    </span>
                    <SeverityPill severity={current.output.predictions[0].risk} />
                    <Chip tone={AI_TONE.attention} className="font-mono text-[8px] uppercase tracking-wider">
                      conf · {current.output.predictions[0].confidence}
                    </Chip>
                  </div>
                  <p className="mt-2 font-mono text-[13px] font-semibold text-jtext">
                    {current.output.predictions[0].action}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-jtext/90">
                    {current.output.predictions[0].explanation}
                  </p>
                  <p className="mt-1 font-mono text-[9px] leading-relaxed text-jmuted/70">
                    uncertain because: {current.output.predictions[0].uncertainty}
                  </p>
                  <p className="mt-1.5 font-mono text-[9px] leading-relaxed text-jamber">
                    → {current.output.predictions[0].suggestedResponse}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {current.output.predictions[0].messageRefs?.map((r: MessageRef) => (
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
              )}

              {current.output.predictions.length > 1 && (
                <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-jmuted/60">
                  Other possible actions
                </p>
              )}

              {current.output.predictions.slice(1).map((p: Prediction) => (
                <div
                  key={p.id}
                  className="border-b border-jborder/40 py-3 last:border-0 last:pb-0"
                  style={{ scrollMarginTop: "2rem" }}
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <span className="font-mono text-[8px] uppercase tracking-widest text-jamber">
                      {p.action}
                    </span>
                    <span className={`font-mono text-[9px] uppercase tracking-widest ${CATEGORY_COLORS[p.category ?? ""] ?? ""}`}>
                      {CATEGORY_LABELS[p.category ?? ""] ?? p.category}
                    </span>
                    <Chip tone={AI_TONE.neutral} className="font-mono text-[8px] uppercase tracking-wider">
                      conf · {p.confidence}
                    </Chip>
                    <SeverityPill severity={p.risk} />
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-jtext/90">{p.explanation}</p>
                  <p className="mt-1 font-mono text-[9px] leading-relaxed text-jmuted/70">
                    uncertain because: {p.uncertainty}
                  </p>
                  <p className="mt-1 font-mono text-[9px] leading-relaxed text-jamber">
                    → {p.suggestedResponse}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.messageRefs?.map((r: MessageRef) => (
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

              {current.output?.currentStrategy && (
                <div className="mt-3 border-t border-jborder/40 px-1">
                  <p className="font-mono text-[8px] uppercase tracking-widest text-jmuted/60">Current strategy</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-jtext/90">{current.output.currentStrategy}</p>
                </div>
              )}

              {current.output?.indicators?.length > 0 && (
                <div className="mt-3 border-t border-jborder/40 px-1">
                  <p className="font-mono text-[8px] uppercase tracking-widest text-jmuted/60">Indicators</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {current.output.indicators.map((x: PredictionIndicator, i: number) => (
                      <span
                        key={i}
                        className={`font-mono text-[8px] uppercase tracking-wider border px-2 py-1 ${CATEGORY_COLORS[x.level] ?? ""}`}
                      >
                        {x.label} · {x.level}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : current.status === "COMPLETED" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-3 py-8 text-center">
              <svg className="size-10 text-jmuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L12 2.25l.813 2.846a4.5 4.5 0 003.09 3.09L18.75 12l-2.846.813a4.5 4.5 0 00-3.09-3.09zM12 6v.75m0 3h.75m-3 0h-.75" />
              </svg>
              <p className="font-mono text-[10px] uppercase tracking-widest text-jmuted">No predictions</p>
              <p className="font-mono text-[9px] text-jmuted/60">
                {current.limitations?.[0] ?? "The conversation is too thin to forecast reliably."}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border-b border-jborder/40 px-3 py-6 text-center">
          <svg className="size-8 text-jmuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L12 2.25l.813 2.846a4.5 4.5 0 003.09 3.09L18.75 12l-2.846.813a4.5 4.5 0 00-3.09-3.09zM12 6v.75m0 3h.75m-3 0h-.75" />
          </svg>
          <p className="font-mono text-[10px] uppercase tracking-widest text-jmuted">No forecast yet</p>
          <p className="font-mono text-[9px] text-jmuted/60">
            {current === undefined ? "Waiting for the case to load…" : "Hit Forecast to see possible next moves."}
          </p>
        </div>
      )}
    </div>
  );
}
