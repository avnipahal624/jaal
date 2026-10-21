import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { BottomConsole } from "@/components/console/BottomConsole";
import { ConversationConsole } from "@/components/conversation/ConversationConsole";
import { EvidenceDrawer } from "@/components/evidence/EvidenceDrawer";
import { EvidencePanel } from "@/components/evidence/EvidencePanel";
import { AiAnalysisPanel } from "@/components/analysis/AiAnalysisPanel";
import { AiStrategyPanel } from "@/components/analysis/AiStrategyPanel";
import { DetectedTactics } from "@/components/analysis/DetectedTactics";
import { KillChainTimeline } from "@/components/investigation/KillChainTimeline";
import { WorkspaceHeader } from "@/components/investigation/WorkspaceHeader";
import { Panel } from "@/components/ui/panel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { STAGE_LABELS } from "@/services/investigationService";
import { useJaal } from "@/state/JaalProvider";
import { cn } from "@/lib/utils";
import type { CaseRuntime, Investigation } from "@/types/investigation";
import { Radio } from "lucide-react";

type MobileTab = "chat" | "analysis" | "evidence" | "logs";

const MOBILE_TABS: { id: MobileTab; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "analysis", label: "AI analysis" },
  { id: "evidence", label: "Evidence" },
  { id: "logs", label: "Logs" },
];

/**
 * The four stacked AI sections: message analysis (~145px), strategy (~160px),
 * kill-chain (~145px) and detected tactics (remaining height). Fixed heights
 * with shrink-0 prevent the flex column from compressing/overlapping panels;
 * each body scrolls independently.
 */
function AnalysisColumn({
  runtime,
  investigation,
  onSend,
}: {
  runtime: CaseRuntime;
  investigation: Investigation;
  onSend: (text: string) => void;
}) {
  const messageNumbers: Record<string, number> = {};
  runtime.messages.forEach((m, i) => {
    messageNumbers[m.id] = i + 1;
  });

  return (
    <>
      <Panel
        label="AI analysis"
        className="h-[145px] shrink-0"
        bodyClassName="overflow-y-auto"
        right={
          <span className="whitespace-nowrap font-mono text-[8px] uppercase tracking-widest text-jmuted/80">
            Simulation mode — analysis engine
          </span>
        }
      >
        <AiAnalysisPanel runtime={runtime} />
      </Panel>

      <Panel
        label="AI investigation strategy"
        className="h-[160px] shrink-0"
        bodyClassName="overflow-y-auto"
      >
        <AiStrategyPanel
          runtime={runtime}
          investigation={investigation}
          onSend={onSend}
        />
      </Panel>

      <Panel
        label={
          <div className="flex items-center gap-2">
            <p className="jaal-label">Scam kill-chain</p>
            <span className="font-mono text-[9px] tracking-widest text-jmuted">
              {runtime.stages.filter((s) => s.status !== "pending").length}
              /{runtime.stages.length}
            </span>
          </div>
        }
        className="h-[145px] shrink-0"
        bodyClassName="overflow-y-auto"
      >
        <KillChainTimeline
          stages={runtime.stages}
          messages={runtime.messages}
          tactics={runtime.tactics}
        />
      </Panel>

      <Panel
        label="Detected tactics"
        className="min-h-0 flex-1"
        bodyClassName="overflow-y-auto"
        right={
          <span className="font-mono text-[9px] tracking-widest text-jamber">
            {runtime.tactics.length} hits
          </span>
        }
      >
        <DetectedTactics
          tactics={runtime.tactics}
          messageNumbers={messageNumbers}
        />
      </Panel>
    </>
  );
}

/** Mobile-only case strip: logo, case ID, simulation status. */
function MobileCaseBar({
  investigation,
  runtime,
}: {
  investigation: Investigation;
  runtime: CaseRuntime;
}) {
  const activeStage = runtime.stages.find((s) => s.status === "active");
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-jborder/70 bg-jsurface/80 px-3 py-2">
      <span className="flex size-7 shrink-0 items-center justify-center border border-jcyan/60 bg-jcyan/10 font-mono text-[11px] font-bold text-jcyan">
        JA
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] tracking-wider text-jcyan">
            {investigation.id}
          </span>
          <span
            className={cn(
              "flex items-center gap-1 border px-1 py-px font-mono text-[8px] uppercase tracking-widest",
              runtime.status === "running"
                ? "border-jred/50 bg-jred/10 text-jred"
                : runtime.status === "paused"
                  ? "border-jamber/50 bg-jamber/10 text-jamber"
                  : "border-jgreen/50 bg-jgreen/10 text-jgreen",
            )}
          >
            <Radio
              className={cn(
                "size-2",
                runtime.status === "running" && "jaal-pulse",
              )}
            />
            {runtime.status}
          </span>
          {activeStage && (
            <span className="hidden truncate font-mono text-[8px] uppercase tracking-widest text-jamber sm:inline">
              stage · {activeStage.label}
            </span>
          )}
        </div>
        <h1 className="truncate text-xs font-semibold text-jtext">
          {investigation.title}
        </h1>
      </div>
    </div>
  );
}

export default function InvestigationWorkspacePage() {
  const {
    state,
    sendMessage,
    endInvestigation,
    togglePause,
    resetCase,
    createReport,
  } = useJaal();
  const navigate = useNavigate();
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const [evidenceDrawerId, setEvidenceDrawerId] = useState<string | null>(null);
  const [evidenceSheetOpen, setEvidenceSheetOpen] = useState(false);
  const [highlightMsgId, setHighlightMsgId] = useState<string | null>(null);

  const investigation = state.investigations.find((i) => i.id === "JAAL-001");
  const runtime = state.sessions["JAAL-001"];

  if (!investigation || !runtime) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-10">
        <p className="font-mono text-xs text-jmuted">
          Case not found. Open a case from the investigations list.
        </p>
      </div>
    );
  }

  const evidenceDrawerItem =
    runtime.evidence.find((e) => e.id === evidenceDrawerId) ?? null;

  // MSG #NN lookup so evidence can reference its source line.
  const messageNumbers: Record<string, number> = {};
  runtime.messages.forEach((m, i) => {
    messageNumbers[m.id] = i + 1;
  });

  const send = (text: string) => void sendMessage(investigation.id, text);

  const evidencePanel = (footer?: ReactNode) => (
    <EvidencePanel
      caseId={investigation.id}
      messageNumbers={messageNumbers}
      onOpenItem={setEvidenceDrawerId}
      footer={footer}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Desktop investigation header */}
      <div className="hidden lg:block">
        <WorkspaceHeader
          investigation={investigation}
          runtime={runtime}
          onPause={() => togglePause(investigation.id)}
          onEnd={() => endInvestigation(investigation.id)}
          onReset={() => resetCase(investigation.id)}
          onReport={() => {
            const report = createReport(investigation.id);
            if (report) navigate(`/reports/${report.id}`);
          }}
          onOpenEvidence={() => setEvidenceSheetOpen(true)}
        />
      </div>

      {/* Mobile header + tab navigation */}
      <div className="lg:hidden">
        <MobileCaseBar investigation={investigation} runtime={runtime} />
        <nav className="flex shrink-0 border-b border-jborder/70 bg-jsurface/60">
          {MOBILE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMobileTab(t.id)}
              className={cn(
                "relative flex-1 px-1 py-2.5 font-mono text-[10px] uppercase tracking-widest transition-colors",
                mobileTab === t.id
                  ? "text-jcyan"
                  : "text-jmuted hover:text-jtext",
              )}
            >
              {t.label}
              {t.id === "evidence" && runtime.evidence.length > 0 && (
                <span className="ml-1 text-jcyan/80">
                  {runtime.evidence.length}
                </span>
              )}
              {mobileTab === t.id && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 bg-jcyan" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Desktop workspace — fills the shell below the case header. */}
      <div className="hidden min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-4 lg:grid lg:grid-cols-[43fr_57fr] xl:grid-cols-[43fr_30fr_27fr]">
        {/* Left — conversation (always the dominant surface). */}
        <div className="flex min-h-0 min-w-0 flex-col">
          <ConversationConsole
            investigation={investigation}
            runtime={runtime}
            highlightId={highlightMsgId}
          />
        </div>

        {/* Center — AI analysis stack. */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto">
          <AnalysisColumn
            runtime={runtime}
            investigation={investigation}
            onSend={send}
          />
        </div>

        {/* Right — evidence locker (desktop column). */}
        <div className="hidden min-h-0 min-w-0 xl:flex">
          {evidencePanel(
            <div className="flex items-center justify-between font-mono text-[8px] uppercase tracking-widest text-jmuted/70">
              <span>SHA-256 · Web Crypto</span>
              <a
                href="/evidence"
                className="text-jcyan transition-colors hover:text-jcyan/80"
              >
                Full archive →
              </a>
            </div>,
          )}
        </div>
      </div>

      {/* Mobile workspace — one active tab at a time. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 lg:hidden">
        {mobileTab === "chat" && (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ConversationConsole
              investigation={investigation}
              runtime={runtime}
              highlightId={highlightMsgId}
            />
          </div>
        )}

        {mobileTab === "analysis" && (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {/* Current scam stage strip */}
            <div className="flex items-center gap-2 border border-jborder/60 bg-jsurface px-2.5 py-1.5">
              <span className="jaal-label shrink-0">Stage</span>
              {(() => {
                const active = runtime.stages.find(
                  (s) => s.status === "active",
                );
                return (
                  <>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-wider",
                        active ? "text-jamber" : "text-jmuted",
                      )}
                    >
                      {active
                        ? active.label
                        : STAGE_LABELS[investigation.currentStage]}
                    </span>
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-jmuted">
                      {runtime.stages.filter((s) => s.status !== "pending").length}
                      /{runtime.stages.length} detected
                    </span>
                  </>
                );
              })()}
            </div>
            <AnalysisColumn
              runtime={runtime}
              investigation={investigation}
              onSend={send}
            />
          </div>
        )}

        {mobileTab === "evidence" && (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {evidencePanel()}
          </div>
        )}

        {mobileTab === "logs" && (
          <div className="min-h-0 flex-1">
            <BottomConsole caseId={investigation.id} embedded />
          </div>
        )}
      </div>

      {/* Tablet evidence sheet (replaces the desktop right column). */}
      <Sheet open={evidenceSheetOpen} onOpenChange={setEvidenceSheetOpen}>
        <SheetContent className="w-full max-w-md border-jborder/80 bg-background/95 backdrop-blur-sm">
          <SheetHeader className="sr-only">
            <SheetTitle>Evidence locker</SheetTitle>
            <SheetDescription>
              Identifiers extracted from this investigation.
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            <EvidencePanel
              caseId={investigation.id}
              messageNumbers={messageNumbers}
              onOpenItem={(id) => {
                setEvidenceSheetOpen(false);
                setEvidenceDrawerId(id);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <EvidenceDrawer
        item={evidenceDrawerItem}
        caseId={investigation.id}
        open={evidenceDrawerId !== null}
        onOpenChange={(open) => {
          if (!open) setEvidenceDrawerId(null);
        }}
        onOpenSource={() => {
          const sourceId = evidenceDrawerItem?.sourceMessageId ?? null;
          setEvidenceDrawerId(null);
          if (sourceId) {
            setMobileTab("chat");
            setHighlightMsgId(sourceId);
          }
        }}
      />

      {/* Bottom activity console — desktop only (mobile uses the Logs tab). */}
      <div className="hidden shrink-0 lg:block">
        <BottomConsole caseId={investigation.id} />
      </div>
    </div>
  );
}
