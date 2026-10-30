import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { api } from "@/convex/_generated/api";
import { Brain, Activity, MessageSquare, Link2, FileText, Clock, CheckCircle2, XCircle, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/panel";
import { statusStyle } from "@/theme/status";
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
  { key: "threat", label: "Threat Intelligence Analyst", desc: "Contextual read of the conversation: social engineering, manipulation, financial pressure, information extraction.", icon: Brain, color: "text-jcyan", accent: "border-jcyan/40", bg: "bg-jcyan/5" },
  { key: "prediction", label: "Behaviour Prediction Engine", desc: "Possible next moves the scammer could take, ranked by confidence, with uncertainty spelled out.", icon: Activity, color: "text-jamber", accent: "border-jamber/40", bg: "bg-jamber/5" },
  { key: "copilot", label: "Investigation Copilot", desc: "Ask anything about this case. Answers cite the messages and evidence behind them.", icon: MessageSquare, color: "text-jcyan", accent: "border-jcyan/40", bg: "bg-jcyan/5" },
  { key: "correlation", label: "Evidence Correlation", desc: "Candidate relationships between indicators, messages and tactics awaiting your review.", icon: Link2, color: "text-jamber", accent: "border-jamber/40", bg: "bg-jamber/5" },
  { key: "report", label: "Forensic Report Assistant", desc: "AI-written narrative sections assembled from the verified case record — facts stay separate from interpretations.", icon: FileText, color: "text-jteal", accent: "border-jteal/40", bg: "bg-jteal/5" },
] as const;

type ModuleKey = (typeof MODULES)[number]["key"];

function StatusBadge({ status }: { status: AiAnalysis["status"] }) {
  if (status === "COMPLETED") return <Chip tone={AI_TONE.success} className="font-mono text-[8px]"><CheckCircle2 className="size-2.5" /> d</Chip>;
  if (status === "PROCESSING") return <Chip tone={AI_TONE.warning} className="font-mono text-[8px]"><Loader2 className="size-2.5 animate-spin" /> p</Chip>;
  if (status === "FAILED") return <Chip tone={AI_TONE.error} className="font-mono text-[8px]"><XCircle className="size-2.5" /> f</Chip>;
  if (status === "UNAVAILABLE") return <Chip tone={AI_TONE.attention} className="font-mono text-[8px]"><Clock className="size-2.5" /> u</Chip>;
  return <Chip tone={AI_TONE.neutral} className="font-mono text-[8px]">· n</Chip>;
}

export function IntelligenceHub({
  caseId,
  analyses,
  suggestions,
}: {
  caseId: string;
  analyses: AiAnalysis[];
  suggestions: { pending: number; total: number } | null;
}) {
  const [active, setActive] = useState<ModuleKey>("threat");

  const rows = useMemo(
    () =>
      MODULES.map((m) => ({
        ...m,
        state: analyses.find((a) => a.module === m.key) ?? null,
      })),
    [analyses],
  );

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
          {rows.map((m) => (
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
                <StatusBadge status={m.state?.status ?? "NOT_STARTED"} />
                {m.state?.status === "COMPLETED" || m.state?.status === "PROCESSING" ? (
                  <span className="font-mono text-[8px] text-jmuted/50">{m.state.status === "COMPLETED" ? "ready" : "processing"}</span>
                ) : null}
              </div>
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {active === "threat" && <ThreatView caseId={caseId} />}
          {active === "prediction" && <PredictionView caseId={caseId} />}
          {active === "copilot" && <CopilotView caseId={caseId} />}
          {active === "correlation" && <CorrelationView caseId={caseId} suggestions={suggestions ?? null} />}
          {active === "report" && <ReportView caseId={caseId} />}
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
  const caseId = id ?? "";

  const analysisData = useQuery(api.intelligence.analyses, { caseId });
  const suggestionData = useQuery(api.intelligence.suggestions, { caseId });

  const analyses: AiAnalysis[] = useMemo(() => analysisData?.analyses ?? [], [analysisData]);

  const suggestions = useMemo(() => {
    if (!analysisData || !suggestionData) return null;
    const pending = suggestionData.suggestions.filter((s) => s.status === "PENDING_REVIEW").length;
    return { pending, total: suggestionData.suggestions.length };
  }, [analysisData, suggestionData]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <IntelligenceHub caseId={caseId} analyses={analyses} suggestions={suggestions} />
    </div>
  );
}
