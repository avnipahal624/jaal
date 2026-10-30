import { useQueries } from "convex/react";
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { api } from "@/convex/_generated/api";
import { Brain, Activity, MessageSquare, Link2, FileText, Clock, CheckCircle2, XCircle, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { statusStyle } from "@/theme/status";
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
  { key: "threat", label: "Threat Intelligence Analyst", desc: "Contextual read of the conversation: social engineering, manipulation, financial pressure, information extraction.", icon: Brain, color: "text-jcyan", accent: "border-jcyan/40", bg: "bg-jcyan/5" },
  { key: "prediction", label: "Behaviour Prediction Engine", desc: "Possible next moves the scammer could take, ranked by confidence, with uncertainty spelled out.", icon: Activity, color: "text-jamber", accent: "border-jamber/40", bg: "bg-jamber/5" },
  { key: "copilot", label: "Investigation Copilot", desc: "Ask anything about this case. Answers cite the messages and evidence behind them.", icon: MessageSquare, color: "text-jcyan", accent: "border-jcyan/40", bg: "bg-jcyan/5" },
  { key: "correlation", label: "Evidence Correlation", desc: "Candidate relationships between indicators, messages and tactics awaiting your review.", icon: Link2, color: "text-jamber", accent: "border-jamber/40", bg: "bg-jamber/5" },
  { key: "report", label: "Forensic Report Assistant", desc: "AI-written narrative sections assembled from the verified case record — facts stay separate from interpretations.", icon: FileText, color: "text-jteal", accent: "border-jteal/40", bg: "bg-jteal/5" },
] as const;

type ModuleKey = (typeof MODULES)[number]["key"];

function StatusBadge({ status }: { status: AiAnalysis["status"] }) {
  if (status === "COMPLETED") return <Badge tone="success" className="font-mono text-[8px]"><CheckCircle2 className="size-2.5" /> d</Badge>;
  if (status === "PROCESSING") return <Badge tone="warning" className="font-mono text-[8px]"><Loader2 className="size-2.5 animate-spin" /> p</Badge>;
  if (status === "FAILED") return <Badge tone="error" className="font-mono text-[8px]"><XCircle className="size-2.5" /> f</Badge>;
  if (status === "UNAVAILABLE") return <Badge tone="attention" className="font-mono text-[8px]"><Clock className="size-2.5" /> u</Badge>;
  return <Badge tone="neutral" className="font-mono text-[8px]">· n</Badge>;
}

export function IntelligenceHub({
  analyses,
  suggestions,
}: {
  analyses: AiAnalysis[];
  suggestions: { pending: number; total: number } | null;
}) {
  const [active, setActive] = useState<ModuleKey>("threat");

  const queries = useQueries(
    MODULES.map((m) => ({
      id: `ai-${m.key}`,
      queryKey: [api.intelligence.getAnalysis, "" + analyses[0]?.caseId, m.key],
      queryFn: () => api.intelligence.getAnalysis({ caseId: "" + analyses[0]?.caseId, module: m.key }),
      stale: false,
    })),
  );

  const rows = useMemo(() => {
    const byModule = new Map<ModuleKey, AiAnalysis | null>();
    for (const a of analyses) byModule.set(a.module as ModuleKey, a);
    return MODULES.map((m) => ({
      ...m,
      state: byModule.get(m.key) ?? null,
      result: queries.find((q) => q.queryKey[2] === m.key)?.data ?? null,
    }));
  }, [analyses, queries]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-jborder/50 px-3 py-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-jmuted">AI INTELLIGENCE</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-jmuted/60">
          ·
          {analyses.length} analysis{endings(analyses.length)}
        </span>
        {suggestions && suggestions.pending > 0 && (
          <span className="font-mono text-[9px] uppercase tracking-widest text-jamber" style={statusStyle("review", "needsreview")}>
            {suggestions.pending} pending
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 font-mono text-[10px] uppercase tracking-wider text-jcyan hover:bg-jcyan/10"
            onClick={() => setActive("threat")}
          >
            Analysis hub
          </Button>
          <Button
            size="sm"
            className="font-mono text-[10px] uppercase tracking-wider text-jcyan hover:bg-jcyan/10"
            onClick={() => setActive("threat")}
          >
            <Plus className="size-3" /> New analysis
          </Button>
        </div>
      </div>

      <div className="flex flex-col" style={{ minHeight: 0 }}>
        <div className="flex flex-wrap gap-2 overflow-x-auto py-2">
          {MODULES.map((m) => {
            const state = m.state;
            const result = m.result;
            const done = state?.status === "COMPLETED" || (result?.status === "COMPLETED");
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setActive(m.key)}
                className={`flex flex-col items-start gap-1.5 border px-3 py-2.5 text-left transition-colors ${
                  active === m.key
                    ? "border-jcyan/60 bg-jcyan/5"
                    : "border-jborder/50 bg-jsurface/40 hover:border-jborder/70 hover:bg-jsurface/70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`flex size-6 items-center justify-center rounded-md border ${m.accent} ${m.bg}`}>
                    <m.icon className={`size-3.5 ${m.color}`} />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-jtext">{m.label}</span>
                </div>
                <p className="text-[10px] leading-relaxed text-jmuted/70">{m.desc}</p>
                <div className="flex items-center gap-2">
                  <StatusBadge status={state?.status ?? "NOT_STARTED"} />
                  {state?.status === "COMPLETED" || state?.status === "PROCESSING" ? (
                    <span className="font-mono text-[8px] text-jmuted/50">{state?.status === "COMPLETED" ? "ready" : "processing"}</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {active === "threat" && (
            <ThreatView caseId={useParams().id ?? ""} analysis={rows.find((r) => r.key === "threat")?.state as AiAnalysis | null} stale={rows.find((r) => r.key === "threat")?.state?.stale ?? false} />
          )}
          {active === "prediction" && (
            <PredictionView caseId={useParams().id ?? ""} analysis={rows.find((r) => r.key === "prediction")?.state as AiAnalysis | null} stale={rows.find((r) => r.key === "prediction")?.state?.stale ?? false} />
          )}
          {active === "copilot" && <CopilotView caseId={useParams().id ?? ""} />}
          {active === "correlation" && <CorrelationView caseId={useParams().id ?? ""} suggestions={suggestions ?? null} />}
          {active === "report" && (
            <ReportView caseId={useParams().id ?? ""} analysis={rows.find((r) => r.key === "report")?.state as AiAnalysis | null} stale={rows.find((r) => r.key === "report")?.state?.stale ?? false} />
          )}
        </div>
      </div>
    </div>
  );
}

function endings(n: number): string {
  return n === 1 ? " analysis" : " analyses";
}

export default function AiIntelligencePage() {
  const { id } = useParams<{ id: string }>();
  const [suggestions, setSuggestions] = useState<{ pending: number; total: number } | null>(null);

  const analysesQuery = useQueries(
    ([id].filter(Boolean) as [string])
      .map((id) => ({ caseId: id! }))
      .map(({ caseId }) => ({
        queryKey: [api.intelligence.analyses, caseId],
        queryFn: () => api.intelligence.analyses({ caseId }),
        stale: false,
      })),
  );
  const analyses = analysesQuery.map((q) => q.data as AiAnalysis[]).filter((x): x is AiAnalysis[] => Array.isArray(x));

  const suggestionsQuery = useQueries([
    {
      queryKey: [api.intelligence.suggestions, id],
      queryFn: () => api.intelligence.suggestions({ caseId: id ?? "" }),
      stale: false,
    },
  ]).find((q) => q.data)?.data as { pendingSuggestions: number; suggestions: unknown[] } | null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <IntelligenceHub
        analyses={analyses[0] ?? []}
        suggestions={
          suggestionsQuery
            ? { pending: suggestionsQuery.pendingSuggestions, total: suggestionsQuery.suggestions.length }
            : null
        }
      />
    </div>
  );
}
