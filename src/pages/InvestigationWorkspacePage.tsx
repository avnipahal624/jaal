import { AiAnalysisPanel } from "@/components/analysis/AiAnalysisPanel";
import { AiStrategyPanel } from "@/components/analysis/AiStrategyPanel";
import { DetectedTactics } from "@/components/analysis/DetectedTactics";
import { BottomConsole } from "@/components/console/BottomConsole";
import { ConversationConsole } from "@/components/conversation/ConversationConsole";
import { EvidenceDrawer } from "@/components/evidence/EvidenceDrawer";
import { EvidencePanel } from "@/components/evidence/EvidencePanel";
import { KillChainTimeline } from "@/components/investigation/KillChainTimeline";
import { WorkspaceHeader } from "@/components/investigation/WorkspaceHeader";
import { Chip, Panel, STAGE_STATUS_TONE } from "@/components/ui/panel";
import { useInvestigation } from "@/hooks/useInvestigation";
import { useSimulation } from "@/hooks/useSimulation";
import { useJaal } from "@/state/JaalProvider";
import { cn } from "@/lib/utils";
import { STAGE_LABELS } from "@/services/investigationService";
import {
  Brain,
  FolderKanban,
  MessageSquare,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";

type MobileTab = "chat" | "analysis" | "evidence" | "logs";

const TABS: { id: MobileTab; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "analysis", label: "AI analysis", icon: Brain },
  { id: "evidence", label: "Evidence", icon: ShieldCheck },
  { id: "logs", label: "Logs", icon: ScrollText },
];

export default function InvestigationWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { endInvestigation, resetCase, createReport, notify, togglePause } =
    useJaal();
  const { investigation, runtime } = useInvestigation(id);
  const { send } = useSimulation(id);

  const [searchParams] = useSearchParams();
  const [openEvidenceId, setOpenEvidenceId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(
    () => searchParams.get("msg"),
  );
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");

  const messageNumbers = useMemo(() => {
    const map: Record<string, number> = {};
    runtime?.messages.forEach((m, i) => {
      map[m.id] = i + 1;
    });
    return map;
  }, [runtime?.messages]);

  const activeStage = useMemo(
    () => runtime?.stages.find((s) => s.status === "active"),
    [runtime],
  );

  if (!investigation || !runtime || !id) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <FolderKanban className="size-7 text-jmuted/60" />
        <p className="text-sm text-jmuted">Case not found in this session.</p>
        <Link
          to="/investigations"
          className="border border-jcyan/50 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-jcyan transition-colors hover:bg-jcyan/10"
        >
          Back to investigations
        </Link>
      </div>
    );
  }

  const evidenceItem = runtime.evidence.find((e) => e.id === openEvidenceId) ?? null;

  const handleReport = () => {
    const report = createReport(investigation.id);
    if (report) navigate(`/reports/${report.id}`);
    else
      notify({
        title: "Report generation failed",
        detail: "Case state unavailable.",
        caseId: investigation.id,
        kind: "system",
      });
  };

  const handleEnd = () => {
    endInvestigation(investigation.id);
    navigate(`/investigations/${investigation.id}/complete`);
  };

  const openSource = (messageId: string) => {
    setMobileTab("chat");
    setHighlightId(messageId);
  };

  const conversation = (
    <ConversationConsole
      investigation={investigation}
      runtime={runtime}
      highlightId={highlightId}
    />
  );

  const killChain = (
    <KillChainTimeline
      stages={runtime.stages}
      messages={runtime.messages}
      tactics={runtime.tactics}
    />
  );

  const strategy = (
    <AiStrategyPanel
      runtime={runtime}
      investigation={investigation}
      onSend={(text) => void send(text)}
    />
  );

  const tacticsList = (
    <DetectedTactics tactics={runtime.tactics} messageNumbers={messageNumbers} />
  );

  const evidence = (
    <EvidencePanel
      caseId={investigation.id}
      messageNumbers={messageNumbers}
      onOpenItem={setOpenEvidenceId}
      onOpenSource={openSource}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[9px] uppercase tracking-widest text-jmuted">
            sha-256 · web crypto
          </span>
          <Link
            to={`/evidence?case=${investigation.id}`}
            className="font-mono text-[9px] uppercase tracking-wider text-jcyan hover:text-jtext"
          >
            full archive →
          </Link>
        </div>
      }
    />
  );

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
      <WorkspaceHeader
        investigation={investigation}
        runtime={runtime}
        onPause={() => togglePause(investigation.id)}
        onEnd={handleEnd}
        onReset={() => resetCase(investigation.id)}
        onReport={handleReport}
      />

      {/* Desktop (xl+): 43 / 30 / 27 workspace */}
      <div className="hidden min-h-0 flex-1 grid-cols-[minmax(0,43fr)_minmax(0,30fr)_minmax(0,27fr)] gap-2 p-2 xl:grid">
        {conversation}
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          <Panel
            label={
              <div className="flex items-center gap-2">
                <Brain className="size-3.5 text-jcyan" />
                <p className="jaal-label !text-jcyan">AI analysis</p>
              </div>
            }
            right={
              <span className="font-mono text-[8px] uppercase tracking-widest text-jmuted/70">
                local engine · simulation
              </span>
            }
          >
            <AiAnalysisPanel runtime={runtime} />
          </Panel>

          <Panel
            label={
              <p className="jaal-label !text-jcyan">AI investigation strategy</p>
            }
          >
            {strategy}
          </Panel>

          <Panel
            label={
              <div className="flex items-center gap-2">
                <p className="jaal-label !text-jcyan">Scam kill-chain</p>
                <span className="font-mono text-[9px] text-jmuted">
                  {runtime.stages.filter((s) => s.status !== "pending").length}/5
                </span>
              </div>
            }
            bodyClassName="p-2"
          >
            {killChain}
          </Panel>

          <Panel
            label={<p className="jaal-label !text-jcyan">Detected tactics</p>}
            right={
              <span className="font-mono text-[10px] text-jamber">
                {runtime.tactics.length} hit{runtime.tactics.length === 1 ? "" : "s"}
              </span>
            }
            bodyClassName="max-h-64 overflow-y-auto"
          >
            {tacticsList}
          </Panel>
        </div>
        {evidence}
      </div>

      {/* Tablet (lg–xl): two columns */}
      <div className="hidden min-h-0 flex-1 grid-cols-2 gap-2 p-2 lg:grid xl:hidden">
        <div className="flex min-h-0 flex-col">{conversation}</div>
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          <Panel
            label={
              <div className="flex items-center gap-2">
                <p className="jaal-label !text-jcyan">Scam kill-chain</p>
                <span className="font-mono text-[9px] text-jmuted">
                  {runtime.stages.filter((s) => s.status !== "pending").length}/5
                </span>
              </div>
            }
            bodyClassName="p-2"
          >
            {killChain}
          </Panel>
          <Panel label={<p className="jaal-label !text-jcyan">AI investigation strategy</p>}>
            {strategy}
          </Panel>
          <Panel
            label={<p className="jaal-label !text-jcyan">Detected tactics</p>}
            bodyClassName="max-h-60 overflow-y-auto"
          >
            {tacticsList}
          </Panel>
          <div className="flex min-h-0 flex-col">{evidence}</div>
        </div>
      </div>

      {/* Mobile: CHAT | AI ANALYSIS | EVIDENCE | LOGS */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <div className="flex shrink-0 border-b border-jborder/60 bg-jsurface/70">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMobileTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors",
                mobileTab === t.id
                  ? "border-b-2 border-jcyan bg-jcyan/10 text-jcyan"
                  : "text-jmuted hover:text-jtext",
              )}
            >
              <t.icon className="size-3.5" />
              {t.label}
              {t.id === "evidence" && runtime.evidence.length > 0 && (
                <span className="text-jcyan/70">({runtime.evidence.length})</span>
              )}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 p-2">
          {mobileTab === "chat" && (
            <div className="flex h-full min-h-0 flex-col">{conversation}</div>
          )}
          {mobileTab === "analysis" && (
            <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto">
              <div className="flex flex-wrap items-center gap-2 border border-jamber/40 bg-jamber/10 px-3 py-2">
                <span className="jaal-label !text-[9px]">Current stage</span>
                <span className="font-mono text-[11px] font-semibold text-jamber">
                  {activeStage
                    ? activeStage.label
                    : STAGE_LABELS[investigation.currentStage]}
                </span>
                {activeStage && (
                  <Chip tone={STAGE_STATUS_TONE[activeStage.status]} className="!px-1.5 !text-[8px]">
                    {activeStage.status}
                  </Chip>
                )}
              </div>
              <Panel label={<p className="jaal-label !text-jcyan">AI next move</p>}>
                {strategy}
              </Panel>
              <Panel
                label={
                  <div className="flex items-center gap-2">
                    <p className="jaal-label !text-jcyan">Kill-chain</p>
                    <span className="font-mono text-[9px] text-jmuted">
                      {runtime.stages.filter((s) => s.status !== "pending").length}/5
                    </span>
                  </div>
                }
                bodyClassName="p-2"
              >
                {killChain}
              </Panel>
              <Panel label={<p className="jaal-label !text-jcyan">AI analysis</p>}>
                <AiAnalysisPanel runtime={runtime} />
              </Panel>
              <Panel
                label={<p className="jaal-label !text-jcyan">Detected tactics</p>}
                bodyClassName="max-h-72 overflow-y-auto"
              >
                {tacticsList}
              </Panel>
            </div>
          )}
          {mobileTab === "evidence" && <div className="h-full">{evidence}</div>}
          {mobileTab === "logs" && (
            <div className="h-full">
              <BottomConsole caseId={investigation.id} embedded />
            </div>
          )}
        </div>
      </div>

      {/* Bottom console (desktop/tablet) */}
      <div className="hidden lg:block">
        <BottomConsole caseId={investigation.id} />
      </div>

      <EvidenceDrawer
        open={openEvidenceId !== null}
        onOpenChange={(o) => !o && setOpenEvidenceId(null)}
        item={evidenceItem}
        caseId={investigation.id}
      />
    </div>
  );
}
