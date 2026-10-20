import { Chip, Panel, STAGE_STATUS_TONE } from "@/components/ui/panel";
import { TACTIC_META } from "@/services/investigationService";
import { cn } from "@/lib/utils";
import type {
  DetectedTactic,
  KillChainStage,
} from "@/types/investigation";
import type { ConversationMessage } from "@/types/message";
import { formatClock, truncate } from "@/utils/formatters";
import {
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ThreatCharts } from "./ThreatCharts";

const TACTIC_TONE: Record<string, string> = {
  authority_impersonation: "border-jcyan/50 bg-jcyan/10 text-jcyan",
  fear_threat: "border-jred/50 bg-jred/10 text-jred",
  urgency: "border-jamber/50 bg-jamber/10 text-jamber",
  payment_request: "border-jamber/50 bg-jamber/10 text-jamber",
  isolation: "border-jteal/50 bg-jteal/10 text-jteal",
  remote_access: "border-jred/50 bg-jred/10 text-jred",
};

export function AnalysisPanel({
  stages,
  tactics,
  messages,
}: {
  stages: KillChainStage[];
  tactics: DetectedTactic[];
  messages: ConversationMessage[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const activeStage =
    stages.find((s) => s.status === "active") ??
    [...stages].reverse().find((s) => s.status !== "pending") ??
    stages[0]!;

  const supportingMessage = useMemo(
    () =>
      activeStage.messageIds.length > 0
        ? messages.find((m) => m.id === activeStage.messageIds[activeStage.messageIds.length - 1])
        : undefined,
    [activeStage, messages],
  );

  const sortedTactics = useMemo(
    () => [...tactics].sort((a, b) => b.timestamp - a.timestamp),
    [tactics],
  );

  return (
    <div className="flex min-h-0 flex-col gap-2 overflow-y-auto p-0.5">
      {/* Current stage */}
      <Panel
        label={<p className="jaal-label">Current stage</p>}
        right={
          <Chip tone={STAGE_STATUS_TONE[activeStage.status]} pulse={activeStage.status === "active"}>
            {activeStage.status}
          </Chip>
        }
        bodyClassName="p-3"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-semibold text-jcyan">
            0{activeStage.number}
          </span>
          <div>
            <p className="text-sm font-semibold text-jtext">{activeStage.label}</p>
            <p className="text-[10px] text-jmuted">content-derived classification</p>
          </div>
        </div>

        <div className="mt-3 border-l-2 border-jcyan/60 bg-jcyan/[0.05] px-2.5 py-2">
          <p className="jaal-label">Why it was identified</p>
          <p className="mt-1 text-[11px] leading-relaxed text-jtext/90">
            {activeStage.reason || "Awaiting first matching message."}
          </p>
        </div>

        {supportingMessage && (
          <div className="mt-2 border-l-2 border-jred/60 bg-jred/[0.05] px-2.5 py-2">
            <p className="jaal-label">Supporting message</p>
            <p className="mt-1 text-[11px] leading-relaxed text-jtext/90">
              “{truncate(supportingMessage.text, 180)}”
            </p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-jmuted">
              {supportingMessage.author} · {formatClock(supportingMessage.timestamp)}
            </p>
          </div>
        )}

        <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-jmuted/70">
          classification: heuristic pattern match · no confidence score emitted
          by this engine
        </p>
      </Panel>

      {/* Detected tactics */}
      <Panel
        label={<p className="jaal-label">Detected tactics</p>}
        right={
          <span className="font-mono text-[10px] text-jamber">
            {sortedTactics.length} hit{sortedTactics.length === 1 ? "" : "s"}
          </span>
        }
        bodyClassName="max-h-72 overflow-y-auto"
      >
        {sortedTactics.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
            <ShieldAlert className="size-5 text-jmuted/50" />
            <p className="text-xs text-jmuted">No tactics detected yet.</p>
            <p className="font-mono text-[9px] uppercase tracking-widest text-jmuted/60">
              Detection triggers on scammer message content
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-jborder/40">
            {sortedTactics.map((t) => {
              const meta = TACTIC_META[t.tactic];
              const isOpen = expanded === t.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : t.id)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/40"
                  >
                    <span
                      className={cn(
                        "mt-0.5 size-2 shrink-0 border",
                        TACTIC_TONE[t.tactic] ?? "border-jborder",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] font-semibold text-jtext">
                          {meta?.name ?? t.tactic}
                        </span>
                        <span className="shrink-0 font-mono text-[9px] text-jmuted">
                          {formatClock(t.timestamp)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-jmuted">
                        {truncate(t.sourceText, 76)}
                      </span>
                    </span>
                    {isOpen ? (
                      <ChevronUp className="mt-0.5 size-3 shrink-0 text-jmuted" />
                    ) : (
                      <ChevronDown className="mt-0.5 size-3 shrink-0 text-jmuted" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="border-t border-jborder/40 bg-jsurface/70 px-3 py-2">
                      <p className="text-[10px] leading-relaxed text-jmuted">
                        {t.explanation}
                      </p>
                      <p className="mt-1.5 font-mono text-[9px] uppercase tracking-widest text-jcyan/70">
                        source message: {t.messageId ?? "—"}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* Threat analysis charts — real events only */}
      <Panel
        label={
          <div>
            <p className="jaal-label">Threat analysis</p>
            <p className="mt-0.5 text-[10px] text-jmuted">
              Built from actual session events
            </p>
          </div>
        }
        right={<AlertOctagon className="size-3.5 text-jamber" />}
        bodyClassName="p-2"
      >
        <ThreatCharts stages={stages} tactics={tactics} messages={messages} />
      </Panel>
    </div>
  );
}
