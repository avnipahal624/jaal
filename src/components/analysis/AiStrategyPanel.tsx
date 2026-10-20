import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildStrategy } from "@/services/strategyService";
import type { CaseRuntime, Investigation } from "@/types/investigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Compass, Pencil, RotateCcw, X } from "lucide-react";
import { useState } from "react";

/**
 * Section 2 — AI INVESTIGATION STRATEGY.
 *
 * Suggests the next decoy question from the actual conversation: which
 * knowledge goal has not been pursued yet, and why it matters. The operator
 * approves, edits or dismisses it.
 */
export function AiStrategyPanel({
  runtime,
  investigation,
  onSend,
}: {
  runtime: CaseRuntime;
  investigation: Investigation;
  onSend: (text: string) => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const enabled =
    investigation.flags.aiSuggestions &&
    runtime.status === "running";

  const strategy = buildStrategy(runtime);

  if (!investigation.flags.aiSuggestions) {
    return (
      <div className="px-3 py-6 text-center">
        <p className="text-xs text-jmuted">AI suggestions are disabled for this case.</p>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-jmuted/60">
          enable in investigation settings
        </p>
      </div>
    );
  }

  if (runtime.status !== "running") {
    return (
      <div className="px-3 py-6 text-center">
        <p className="text-xs text-jmuted">
          Strategy engine idle — {runtime.status === "paused" ? "simulation paused" : "investigation complete"}.
        </p>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="px-3 py-6 text-center">
        <Check className="mx-auto size-5 text-jgreen" />
        <p className="mt-2 text-xs font-semibold text-jgreen">
          All knowledge goals covered
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-jmuted">
          The decoy has pursued every planned line of inquiry. Continue freely
          or end the investigation to generate the report.
        </p>
      </div>
    );
  }

  if (dismissed) {
    return (
      <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
        <p className="text-xs text-jmuted">Suggestion dismissed.</p>
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="flex items-center gap-1.5 border border-jborder/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-jmuted transition-colors hover:border-jcyan/50 hover:text-jcyan"
        >
          <RotateCcw className="size-3" /> Restore suggestion
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 p-3">
      <div className="border border-jborder/60 bg-jsurface px-2.5 py-1.5">
        <p className="jaal-label !text-[9px]">Objective</p>
        <p className="mt-0.5 text-[11px] leading-snug text-jtext/90">
          {strategy.objective}
        </p>
      </div>
      <div className="border border-jborder/60 bg-jsurface px-2.5 py-1.5">
        <p className="jaal-label !text-[9px]">Missing</p>
        <p className="mt-0.5 text-[11px] leading-snug text-jamber">
          {strategy.missing}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="border-jcyan/50 bg-jsurface text-xs text-jtext focus-visible:border-jcyan/70 focus-visible:ring-jcyan/40"
            />
            <div className="flex gap-1.5">
              <Button
                size="sm"
                disabled={!draft.trim()}
                onClick={() => {
                  onSend(draft.trim());
                  setEditing(false);
                }}
                className="h-7 cursor-pointer gap-1 bg-jcyan px-2 font-mono text-[10px] uppercase tracking-wider text-background hover:bg-jcyan/85"
              >
                <Check className="size-3" /> Send edited
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(false)}
                className="h-7 cursor-pointer border-jborder/70 font-mono text-[10px] uppercase tracking-wider text-jmuted"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="view"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="border border-jcyan/50 bg-jcyan/[0.06] px-2.5 py-2"
          >
            <p className="jaal-label !text-[9px] !text-jcyan">
              Suggested response
            </p>
            <p className="mt-1 text-xs font-medium leading-snug text-jtext">
              “{strategy.question}”
            </p>
            <p className="mt-1.5 text-[10px] leading-relaxed text-jmuted">
              {strategy.reason}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {!editing && (
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            disabled={!enabled}
            onClick={() => onSend(strategy.question)}
            className="h-7 cursor-pointer gap-1.5 bg-jgreen px-2.5 font-mono text-[10px] uppercase tracking-wider text-background hover:bg-jgreen/85 disabled:opacity-40"
          >
            <Check className="size-3" /> Approve & send
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDraft(strategy.question);
              setEditing(true);
            }}
            className="h-7 cursor-pointer gap-1.5 border-jcyan/50 px-2.5 font-mono text-[10px] uppercase tracking-wider text-jcyan hover:bg-jcyan/10 hover:text-jcyan"
          >
            <Pencil className="size-3" /> Edit response
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDismissed(true)}
            className="h-7 cursor-pointer gap-1.5 border-jborder/70 px-2.5 font-mono text-[10px] uppercase tracking-wider text-jmuted hover:border-jred/50 hover:text-jred"
          >
            <X className="size-3" /> Dismiss
          </Button>
        </div>
      )}

      <p className="flex items-start gap-1.5 font-mono text-[8px] uppercase leading-relaxed tracking-widest text-jmuted/60">
        <Compass className="mt-px size-3 shrink-0" />
        suggestion derived from conversation state + local simulation rules
      </p>
    </div>
  );
}
