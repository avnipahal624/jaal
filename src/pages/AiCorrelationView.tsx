import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/panel";
import { AI_TONE } from "./AiActionRunner";

const RELATION_LABELS: Record<string, string> = {
  REPEATED_IDENTIFIER: "Repeated identifier",
  SHARED_TACTIC: "Shared tactic",
  PAYMENT_TACTIC: "Payment tactic",
  CROSS_CHANNEL_PATTERN: "Cross-channel pattern",
  CONTEXTUAL_LINK: "Contextual link",
};

const RELATION_COLORS: Record<string, string> = {
  REPEATED_IDENTIFIER: "border-jcyan/50 bg-jcyan/10 text-jcyan",
  SHARED_TACTIC: "border-jamber/50 bg-jamber/10 text-jamber",
  PAYMENT_TACTIC: "border-jamber/50 bg-jamber/10 text-jamber",
  CROSS_CHANNEL_PATTERN: "border-jamber/50 bg-jamber/10 text-jamber",
  CONTEXTUAL_LINK: "border-jmuted/50 bg-jmuted/10 text-jmuted",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  low: "border-jmuted/50 bg-jmuted/10 text-jmuted",
  medium: "border-jamber/40 bg-jamber/10 text-jamber",
  high: "border-jgreen/40 bg-jgreen/10 text-jgreen",
};

export function CorrelationView({
  caseId,
  suggestions,
}: {
  caseId: string;
  suggestions: { pending: number; total: number } | null;
}) {
  const navigate = useNavigate();
  const list = useQuery(api.intelligence.suggestions, { caseId });
  // Investigator review is the only path to CONFIRMED — nothing auto-confirms.
  const review = useMutation(api.intelligence.reviewSuggestion);
  const [dirty, setDirty] = useState<Record<string, "accept" | "reject">>({});

  const acceptOne = async (id: Id<"correlation_suggestions">) => {
    setDirty((d) => ({ ...d, [id]: "accept" }));
    try {
      await review({ suggestionId: id, decision: "accept", note: "Approved by investigator" });
    } finally {
      setDirty((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
    }
  };
  const rejectOne = async (id: Id<"correlation_suggestions">) => {
    setDirty((d) => ({ ...d, [id]: "reject" }));
    try {
      await review({ suggestionId: id, decision: "reject", note: "Rejected by investigator" });
    } finally {
      setDirty((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
    }
  };

  const pending = list?.suggestions?.filter((s: any) => s.status === "PENDING_REVIEW") ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-jborder/50 px-3 py-2">
        <div>
          <h2 className="font-mono text-[12px] font-semibold text-jtext">Evidence Correlation</h2>
          <p className="font-mono text-[8px] uppercase tracking-widest text-jmuted/60">Module 4 · human-approved relationships</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {pending.length > 0 ? (
            <Chip tone={AI_TONE.warning} className="font-mono text-[9px] uppercase tracking-wider">
              {pending.length} pending review
            </Chip>
          ) : (
            <Chip tone={AI_TONE.neutral} className="font-mono text-[9px] uppercase tracking-wider">
              {suggestions?.pending ?? 0} pending
            </Chip>
          )}
          {suggestions && suggestions.total > 0 && (
            <span className="font-mono text-[9px] text-jmuted/60">{suggestions.total} total</span>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {pending.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-3 py-8 text-center">
            <svg className="size-10 text-jmuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
              <circle cx="12" cy="12" r="3" />
              <circle cx="19" cy="12" r="3" />
              <circle cx="12" cy="19" r="3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
            </svg>
            <p className="font-mono text-[10px] uppercase tracking-widest text-jmuted">No pending suggestions</p>
            <p className="font-mono text-[9px] text-jmuted/60">
              Run the correlation analysis or check back after the rule-based scan.
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
            {list?.suggestions?.map((s: any) => (
              <div
                key={s.id}
                className="border-b border-jborder/40 py-3 last:border-0 last:pb-0"
                style={{ scrollMarginTop: "2rem" }}
              >
                <div className="flex flex-wrap items-start gap-2">
                  <span className="font-mono text-[8px] uppercase tracking-widest text-jmuted">
                    Suggestion #{s.id.slice(0, 8)}
                  </span>
                  <Chip tone={AI_TONE.neutral} className="font-mono text-[9px] uppercase tracking-wider">
                    {RELATION_LABELS[s.relation] ?? s.relation}
                  </Chip>
                  <Chip tone={AI_TONE.neutral} className={`font-mono text-[8px] uppercase tracking-wider ${CONFIDENCE_COLORS[s.confidence] ?? ""}`}>
                    {s.confidence} confidence
                  </Chip>
                  <Chip tone={AI_TONE.neutral} className={`font-mono text-[8px] uppercase tracking-wider ${RELATION_COLORS[s.relation] ?? ""}`}>
                    {s.origin === "RULE_BASED" ? "rule-based" : "AI"}
                  </Chip>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-[9px] text-jtext/90">{s.source.label}</span>
                  <span className="font-mono text-[9px] text-jmuted/40">→</span>
                  <span className="font-mono text-[9px] text-jtext/90">{s.target.label}</span>
                  {s.messageRefs && (
                    <span className="font-mono text-[8px] text-jmuted/40">
                      refs: {s.messageRefs.join(", ")}
                    </span>
                  )}
                  {s.evidenceRefs && (
                    <span className="font-mono text-[8px] text-jmuted/40">
                      evidence: {s.evidenceRefs.join(", ")}
                    </span>
                  )}
                </div>

                <p className="mt-1 pl-3 text-[11px] leading-relaxed text-jtext/90 border-l-2 border-jborder/60">
                  {s.explanation}
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="font-mono text-[9px] uppercase tracking-wider text-jgreen hover:bg-jgreen/10"
                    onClick={() => acceptOne(s.id)}
                  >
                    <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="10" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12l2.5 2.5L16 6" />
                    </svg>
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="font-mono text-[9px] uppercase tracking-wider text-jamber hover:bg-jamber/10"
                    onClick={() => rejectOne(s.id)}
                  >
                    <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="10" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-6 6M9 9l6 6" />
                    </svg>
                    Reject
                  </Button>
                  <span className="font-mono text-[8px] text-jmuted/40">
                    {s.status === "PENDING_REVIEW" ? "awaiting your decision" : s.reviewer ? `accepted by ${s.reviewer.slice(0, 6)}` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
