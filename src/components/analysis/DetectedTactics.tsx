import { TACTIC_META } from "@/services/investigationService";
import { cn } from "@/lib/utils";
import type { DetectedTactic } from "@/types/investigation";
import { formatClock, truncate } from "@/utils/formatters";
import { ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";

const TACTIC_TONE: Record<string, string> = {
  authority_impersonation: "border-jcyan/50 bg-jcyan/10 text-jcyan",
  fear_threat: "border-jred/50 bg-jred/10 text-jred",
  urgency: "border-jamber/50 bg-jamber/10 text-jamber",
  payment_request: "border-jamber/50 bg-jamber/10 text-jamber",
  isolation: "border-jteal/50 bg-jteal/10 text-jteal",
  remote_access: "border-jred/50 bg-jred/10 text-jred",
};

/** Compact rows: tactic name, source message excerpt, explanation. */
export function DetectedTactics({
  tactics,
  messageNumbers,
  onSelectTactic,
}: {
  tactics: DetectedTactic[];
  /** message id → MSG #NN */
  messageNumbers: Record<string, number>;
  /** Report the clicked tactic (e.g. to highlight it on the evidence board). */
  onSelectTactic?: (tactic: DetectedTactic) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const sorted = useMemo(
    () => [...tactics].sort((a, b) => b.timestamp - a.timestamp),
    [tactics],
  );

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 px-3 py-8 text-center">
        <ShieldAlert className="size-5 text-jmuted/50" />
        <p className="text-xs text-jmuted">No tactics detected yet.</p>
        <p className="font-mono text-[9px] uppercase tracking-widest text-jmuted/60">
          detection triggers on scammer message content
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-jborder/40">
      {sorted.map((t) => {
        const meta = TACTIC_META[t.tactic];
        const isOpen = expanded === t.id;
        const number = t.messageId ? messageNumbers[t.messageId] : undefined;
        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => {
                setExpanded(isOpen ? null : t.id);
                onSelectTactic?.(t);
              }}
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
                    {number ? `MSG #${String(number).padStart(2, "0")} · ` : ""}
                    {formatClock(t.timestamp)}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-jmuted">
                  {truncate(t.explanation, 80)}
                </span>
              </span>
              {isOpen ? (
                <ChevronUp className="mt-0.5 size-3 shrink-0 text-jmuted" />
              ) : (
                <ChevronDown className="mt-0.5 size-3 shrink-0 text-jmuted" />
              )}
            </button>
            {isOpen && (
              <div className="space-y-1.5 border-t border-jborder/40 bg-jsurface/70 px-3 py-2">
                <p className="text-[10px] leading-relaxed text-jmuted">
                  {t.explanation}
                </p>
                <p className="border-l-2 border-jred/50 pl-2 text-[10px] leading-relaxed text-jtext/80">
                  “{truncate(t.sourceText, 160)}”
                </p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
