import { useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatClock, formatDateTime } from "@/utils/formatters";
import type { AiAnalysis } from "./AiIntelligencePage";

const SECTIONS: { key: keyof AiReportSections; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "Σ" },
  { key: "incidentSummary", label: "Incident summary", icon: "▸" },
  { key: "scope", label: "Scope", icon: "□" },
  { key: "conversationAnalysis", label: "Conversation analysis", icon: "💬" },
  { key: "behaviourAnalysis", label: "Behavioural analysis", icon: "🧠" },
  { key: "recommendations", label: "Recommended next steps", icon: "→" },
  { key: "limitations", label: "Limitations & unknowns", icon: "?" },
];

export interface AiReportSections {
  overview: string;
  incidentSummary: string;
  scope: string;
  conversationAnalysis: string;
  behaviourAnalysis: string;
  recommendations: string[];
  limitations: string[];
}

export function ReportView({
  caseId,
  analysis,
  stale,
}: {
  caseId: string;
  analysis: AiAnalysis | null;
  stale: boolean;
}) {
  const navigate = useNavigate();
  const latest = useQuery(api.intelligence.analyses, { caseId });
  const run = async () => {
    await api.intelligence.reportAssist({ caseId });
  };

  const current = latest?.analyses.find((a) => a.module === "report") ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-jborder/50 px-3 py-2">
        <div>
          <h2 className="font-mono text-[12px] font-semibold text-jtext">Forensic Report Assistant</h2>
          <p className="font-mono text-[8px] uppercase tracking-widest text-jmuted/60">Module 5 · AI-written narrative sections</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!current ? (
            <Button
              onClick={run}
              disabled={!latest}
              className="font-mono text-[10px] uppercase tracking-wider bg-jteal text-background hover:bg-jteal/85"
            >
              <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Generate
            </Button>
          ) : current.status === "PROCESSING" ? (
            <Button variant="outline" disabled className="gap-1.5 font-mono text-[10px] uppercase tracking-wider text-jteal">
              <svg className="size-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              Generating
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-[10px] uppercase tracking-wider text-jteal hover:bg-jteal/10"
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
                <Badge tone="success" className="font-mono text-[9px] uppercase tracking-wider">
                  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12l2.5 2.5L16 6" />
                  </svg>
                  completed
                </Badge>
              ) : current.status === "PROCESSING" ? (
                <Badge tone="warning" className="font-mono text-[9px] uppercase tracking-wider">
                  <svg className="size-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                  processing
                </Badge>
              ) : current.status === "FAILED" ? (
                <Badge tone="error" className="font-mono text-[9px] uppercase tracking-wider">
                  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-6 6M9 9l6 6" />
                  </svg>
                  failed
                </Badge>
              ) : current.status === "UNAVAILABLE" ? (
                <Badge tone="attention" className="font-mono text-[9px] uppercase tracking-wider">
                  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
                  </svg>
                  unavailable
                </Badge>
              ) : (
                <Badge tone="neutral" className="font-mono text-[9px] uppercase tracking-wider">
                  not started
                </Badge>
              )}
              {stale && current.status === "COMPLETED" && (
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
          </div>

          {current.status === "COMPLETED" ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
              {SECTIONS.map((s) => {
                const text =
                  s.key === "recommendations"
                    ? (current.output?.recommendations as string[] | undefined)
                    : (current.output as Record<string, string> | undefined)?.[s.key];
                const isArray = s.key === "recommendations";
                const list = isArray ? (current.output?.recommendations as string[] | undefined) : undefined;
                return (
                  <div
                    key={s.key}
                    className="border-b border-jborder/40 py-3 last:border-0 last:pb-0"
                    style={{ scrollMarginTop: "2rem" }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[8px] uppercase tracking-widest text-jteal">{s.icon}</span>
                      <span className="font-mono text-[10px] font-semibold text-jtext">{s.label}</span>
                    </div>
                    {isArray ? (
                      list?.map((r: string, i: number) => (
                        <p key={i} className="mt-1 font-mono text-[11px] leading-relaxed text-jtext/90">
                          {i + 1}. {r}
                        </p>
                      ))
                    ) : text ? (
                      <p className="mt-1 text-[11px] leading-relaxed text-jtext/90">{text}</p>
                    ) : (
                      <p className="mt-1 font-mono text-[11px] text-jmuted/60">—</p>
                    )}
                  </div>
                );
              })}

              {current.output?.limitations && current.output.limitations.length > 0 && (
                <div className="mt-3 border-t border-jborder/40 px-1">
                  <p className="font-mono text-[8px] uppercase tracking-widest text-jamber">Limitations</p>
                  <ul className="mt-1 list-disc space-y-1 px-4">
                    {current.output.limitations.map((l: string, i: number) => (
                      <li key={i} className="font-mono text-[9px] text-jmuted/80">{l}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : current.status === "COMPLETED" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-3 py-8 text-center">
              <svg className="size-10 text-jmuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L12 2.25l.813 2.846a4.5 4.5 0 003.09 3.09L18.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM12 6v.75m0 3h.75m-3 0h-.75" />
              </svg>
              <p className="font-mono text-[10px] uppercase tracking-widest text-jmuted">No narrative generated</p>
              <p className="font-mono text-[9px] text-jmuted/60">The report ran but produced no sections to show.</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border-b border-jborder/40 px-3 py-6 text-center">
          <svg className="size-8 text-jmuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L12 2.25l.813 2.846a4.5 4.5 0 003.09 3.09L18.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM12 6v.75m0 3h.75m-3 0h-.75" />
          </svg>
          <p className="font-mono text-[10px] uppercase tracking-widest text-jmuted">No report yet</p>
          <p className="font-mono text-[9px] text-jmuted/60">
            {latest === undefined ? "Waiting for the case to load…" : "Hit Generate to add AI narrative sections."}
          </p>
        </div>
      )}
    </div>
  );
}
