import { Chip } from "@/components/ui/panel";
import { TACTIC_META } from "@/services/investigationService";
import { classifyIntent, STAGE_TACTIC_HINT } from "@/services/strategyService";
import { cn } from "@/lib/utils";
import type { CaseRuntime } from "@/types/investigation";
import { formatClock } from "@/utils/formatters";
import { Brain } from "lucide-react";
import { useMemo } from "react";

/**
 * Section 1 — AI ANALYSIS.
 *
 * Shows the latest scammer message under analysis: its number, derived intent
 * and the tactics matched in its content. Derived from the local analysis
 * engine over real session events — no fabricated confidence percentages.
 */
export function AiAnalysisPanel({ runtime }: { runtime: CaseRuntime }) {
  const analysis = useMemo(() => {
    const index = [...runtime.messages]
      .map((m, i) => ({ m, i }))
      .filter((x) => x.m.author === "scammer")
      .pop();
    if (!index) return null;
    const message = index.m;
    const tactics = runtime.tactics.filter((t) => t.messageId === message.id);
    const stageHit = runtime.stages.find((s) => s.messageIds.includes(message.id));
    return {
      number: index.i + 1,
      message,
      tactics,
      intent: classifyIntent(
        tactics.map((t) => t.tactic),
        stageHit?.id ?? null,
      ),
      stageLabel: stageHit ? STAGE_TACTIC_HINT[stageHit.id] : null,
    };
  }, [runtime.messages, runtime.tactics, runtime.stages]);

  if (!analysis) {
    return (
      <div className="flex flex-col items-center gap-1.5 px-3 py-8 text-center">
        <Brain className="size-5 text-jmuted/50" />
        <p className="text-xs text-jmuted">No scammer message to analyze yet.</p>
        <p className="font-mono text-[9px] uppercase tracking-widest text-jmuted/60">
          Analysis starts with the first inbound message
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="border border-jcyan/50 bg-jcyan/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-jcyan">
          MESSAGE #{String(analysis.number).padStart(2, "0")}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-jmuted">
          {formatClock(analysis.message.timestamp)} · {analysis.message.source}
        </span>
      </div>

      <div className="border border-jamber/40 bg-jamber/[0.07] px-2.5 py-1.5">
        <p className="jaal-label !text-[9px] !text-jamber">Intent</p>
        <p className={cn("mt-0.5 font-mono text-xs font-semibold text-jamber")}>
          {analysis.intent}
        </p>
      </div>

      <div>
        <p className="jaal-label !text-[9px] mb-1">Tactics in this message</p>
        {analysis.tactics.length === 0 ? (
          <p className="text-[11px] text-jmuted">
            No tactic pattern matched this message.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {analysis.tactics.map((t) => (
              <Chip key={t.id} tone="border-jred/50 bg-jred/10 text-jred">
                {TACTIC_META[t.tactic]?.name ?? t.tactic}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <div className="border-l-2 border-jred/60 bg-jred/[0.05] px-2.5 py-1.5">
        <p className="jaal-label !text-[9px]">Source text</p>
        <p className="mt-1 text-[11px] leading-relaxed text-jtext/90">
          “{analysis.message.text}”
        </p>
      </div>

      <p className="font-mono text-[8px] uppercase tracking-widest text-jmuted/60">
        local analysis engine · simulation mode — no external model or service
      </p>
    </div>
  );
}
