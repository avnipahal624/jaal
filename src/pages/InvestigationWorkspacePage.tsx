import { AnalysisPanel } from "@/components/analysis/AnalysisPanel";
import { BottomConsole } from "@/components/console/BottomConsole";
import { ConversationConsole } from "@/components/conversation/ConversationConsole";
import { EvidenceDrawer } from "@/components/evidence/EvidenceDrawer";
import { EvidencePanel } from "@/components/evidence/EvidencePanel";
import { KillChainPanel } from "@/components/investigation/KillChainPanel";
import { WorkspaceHeader } from "@/components/investigation/WorkspaceHeader";
import { Chip, Panel } from "@/components/ui/panel";
import { useInvestigation } from "@/hooks/useInvestigation";
import { useJaal } from "@/state/JaalProvider";
import { cn } from "@/lib/utils";
import { FolderKanban, MessageSquare, Radar, ScrollText, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";

type MobileTab = "conversation" | "analysis" | "evidence" | "logs";

const TABS: { id: MobileTab; label: string; icon: typeof MessageSquare }[] = [
  { id: "conversation", label: "Conversation", icon: MessageSquare },
  { id: "analysis", label: "Analysis", icon: Radar },
  { id: "evidence", label: "Evidence", icon: ShieldCheck },
  { id: "logs", label: "Logs", icon: ScrollText },
];

export default function InvestigationWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { togglePause, endInvestigation, resetCase, createReport, notify } =
    useJaal();
  const { investigation, runtime } = useInvestigation(id);

  const [searchParams] = useSearchParams();
  // /investigations/:id?msg=<id> — “open source message” from the full locker.
  const [openEvidenceId, setOpenEvidenceId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(
    () => searchParams.get("msg"),
  );
  const [mobileTab, setMobileTab] = useState<MobileTab>("conversation");

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

  const evidenceItem =
    runtime.evidence.find((e) => e.id === openEvidenceId) ?? null;

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

  const openSource = (messageId: string) => {
    setMobileTab("conversation");
    setHighlightId(messageId);
  };

  const killChain = (
    <KillChainPanel
      stages={runtime.stages}
      messages={runtime.messages}
      tactics={runtime.tactics}
    />
  );

  const conversation = (
    <ConversationConsole
      investigation={investigation}
      runtime={runtime}
      highlightId={highlightId}
      onGenerateReport={handleReport}
    />
  );

  const analysis = (
    <AnalysisPanel
      stages={runtime.stages}
      tactics={runtime.tactics}
      messages={runtime.messages}
    />
  );

  const evidence = (
    <EvidencePanel
      caseId={investigation.id}
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
            full locker →
          </Link>
        </div>
      }
    />
  );

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
      <WorkspaceHeader
        investigation={investigation}
        status={runtime.status}
        startedAt={runtime.startedAt}
        endedAt={runtime.endedAt}
        evidenceCount={runtime.evidence.length}
        activeStage={activeStage}
        onPause={() => togglePause(investigation.id)}
        onEnd={() => endInvestigation(investigation.id)}
        onReset={() => resetCase(investigation.id)}
        onReport={handleReport}
      />

      {/* Desktop (xl+): 4-column investigation console */}
      <div className="hidden min-h-0 flex-1 grid-cols-[236px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.85fr)] gap-2 p-2 xl:grid">
        {/* Left rail: case navigation + kill chain */}
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          <Panel label={<p className="jaal-label">Case navigation</p>} bodyClassName="p-2.5">
            <dl className="space-y-1.5">
              {[
                ["Case ID", investigation.id],
                ["Category", investigation.category],
                ["Source", investigation.source],
                ["Mode", investigation.detectionMode],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <dt className="jaal-label !text-[9px]">{k}</dt>
                  <dd className="truncate font-mono text-[10px] text-jtext">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-2.5 flex flex-wrap gap-1">
              {(
                [
                  ["tactics", investigation.flags.tacticDetection],
                  ["identifiers", investigation.flags.identifierExtraction],
                  ["hashing", investigation.flags.integrityHashing],
                ] as const
              ).map(([k, on]) => (
                <Chip
                  key={k}
                  tone={
                    on
                      ? "border-jgreen/40 bg-jgreen/10 text-jgreen"
                      : "border-jborder/60 text-jmuted/70"
                  }
                >
                  {k} {on ? "on" : "off"}
                </Chip>
              ))}
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              <Link
                to="/evidence"
                className="border border-jborder/60 px-2 py-1 text-center font-mono text-[9px] uppercase tracking-wider text-jmuted transition-colors hover:border-jcyan/50 hover:text-jcyan"
              >
                Locker
              </Link>
              <Link
                to="/reports"
                className="border border-jborder/60 px-2 py-1 text-center font-mono text-[9px] uppercase tracking-wider text-jmuted transition-colors hover:border-jcyan/50 hover:text-jcyan"
              >
                Reports
              </Link>
            </div>
          </Panel>

          <Panel
            label={
              <div className="flex items-center gap-2">
                <p className="jaal-label">Scam kill-chain</p>
                <span className="font-mono text-[9px] text-jmuted">
                  {runtime.stages.filter((s) => s.status !== "pending").length}/5
                </span>
              </div>
            }
            bodyClassName="min-h-0"
          >
            {killChain}
          </Panel>
        </div>

        {conversation}
        <div className="min-h-0">{analysis}</div>
        {evidence}
      </div>

      {/* Tablet (lg–xl): two columns */}
      <div className="hidden min-h-0 flex-1 grid-cols-2 gap-2 p-2 lg:grid xl:hidden">
        <div className="flex min-h-0 flex-col gap-2">
          <div className="min-h-0 flex-1">{conversation}</div>
        </div>
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          <Panel
            label={
              <div className="flex items-center gap-2">
                <p className="jaal-label">Scam kill-chain</p>
                <span className="font-mono text-[9px] text-jmuted">
                  {runtime.stages.filter((s) => s.status !== "pending").length}/5
                </span>
              </div>
            }
          >
            {killChain}
          </Panel>
          {analysis}
          <div className="flex min-h-0 flex-col">{evidence}</div>
        </div>
      </div>

      {/* Mobile: tabs */}
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
          {mobileTab === "conversation" && (
            <div className="flex h-full min-h-0 flex-col">{conversation}</div>
          )}
          {mobileTab === "analysis" && (
            <div className="flex h-full min-h-0 flex-col gap-2">
              <Panel
                label={
                  <div className="flex items-center gap-2">
                    <p className="jaal-label">Scam kill-chain</p>
                    <span className="font-mono text-[9px] text-jmuted">
                      {runtime.stages.filter((s) => s.status !== "pending").length}/5
                    </span>
                  </div>
                }
              >
                {killChain}
              </Panel>
              <div className="min-h-0 flex-1">{analysis}</div>
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

      {/* Bottom console (desktop) */}
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
