import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildStrategy } from "@/services/strategyService";
import type { CaseRuntime, Investigation } from "@/types/investigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Pencil, RotateCcw, X } from "lucide-react";
import { useState } from "react";

/**
 * Section 2 — AI INVESTIGATION STRATEGY (~160px).
 *
 * The single place to review and approve suggested next questions. Content is
 * derived from the actual conversation: which knowledge goal has not been
 * pursued yet, and why it matters. Never renders blank while a strategy
 * exists; idle/paused/disabled states are explicit.
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

  const enabled = investigation.flags.aiSuggestions && runtime.status === "running";
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
          Strategy engine idle —{" "}
          {runtime.status === "paused"
            ? "simulation paused"
            : "investigation complete"}
          .
        </p>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-jmuted/60">
          {runtime.status === "paused"
            ? "resume to regenerate the next move"
            : "restart the simulation to continue"}
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
    <div className="flex flex-col gap-1.5 p-2.5">
      {/* Current objective */}
      <div>
        <p className="font-mono text-[8px] uppercase tracking-widest text-jmuted">
          Current objective
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-jtext/90">
          {strategy.objective}
        </p>
      </div>

      {/* Information gap */}
      <div>
        <p className="font-mono text-[8px] uppercase tracking-widest text-jmuted">
          Information gap
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-jamber">
          {strategy.missing}
        </p>
      </div>

      {/* Suggested next move / edit */}
      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-1.5"
          >
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
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
                className="h-6 cursor-pointer gap-1 bg-jcyan px-2 font-mono text-[10px] uppercase tracking-wider text-background hover:bg-jcyan/85"
              >
                <Check className="size-3" /> Send edited
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(false)}
                className="h-6 cursor-pointer border-jborder/70 font-mono text-[10px] uppercase tracking-wider text-jmuted"
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
            className="border-l-2 border-jcyan/70 bg-jcyan/[0.06] px-2 py-1.5"
          >
            <p className="font-mono text-[8px] uppercase tracking-widest !text-jcyan">
              AI suggested next move
            </p>
            <p className="mt-0.5 text-xs font-medium leading-snug text-jtext">
              “{strategy.question}”
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {!editing && (
        <div>
          <p className="font-mono text-[8px] uppercase tracking-widest text-jmuted">
            Why this question
          </p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-jmuted">
            {strategy.reason}
          </p>
        </div>
      )}

      {!editing && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <Button
            size="sm"
            disabled={!enabled}
            onClick={() => onSend(strategy.question)}
            className="h-6 cursor-pointer gap-1.5 bg-jgreen px-2.5 font-mono text-[10px] uppercase tracking-wider text-background hover:bg-jgreen/85 disabled:opacity-40"
          >
            <Check className="size-3" /> Approve &amp; send
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDraft(strategy.question);
              setEditing(true);
            }}
            className="h-6 cursor-pointer gap-1.5 border-jcyan/50 px-2.5 font-mono text-[10px] uppercase tracking-wider text-jcyan hover:bg-jcyan/10 hover:text-jcyan"
          >
            <Pencil className="size-3" /> Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDismissed(true)}
            className="h-6 cursor-pointer gap-1.5 border-jborder/70 px-2.5 font-mono text-[10px] uppercase tracking-wider text-jmuted hover:border-jred/50 hover:text-jred"
          >
            <X className="size-3" /> Dismiss
          </Button>
        </div>
      )}

      <p className="font-mono text-[8px] uppercase leading-relaxed tracking-widest text-jmuted/50">
        derived from conversation state + local simulation rules
      </p>
    </div>
  );
}
