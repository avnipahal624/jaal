import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

/** The four provider-backed analysis modules (the copilot has its own action). */
export type AiModuleKey = "threat" | "prediction" | "correlation" | "report";

/**
 * Chip tones for AI lifecycle states.
 *
 * Plain Tailwind classes, matching the `Chip tone="border-x/40 bg-x/10 text-x"`
 * convention used across the workspace (see CaseRail / EvidenceCard).
 */
export const AI_TONE = {
  neutral: "border-jborder/50 bg-jsurface/60 text-jmuted",
  success: "border-jgreen/40 bg-jgreen/10 text-jgreen",
  warning: "border-jamber/40 bg-jamber/10 text-jamber",
  error: "border-jred/40 bg-jred/10 text-jred",
  attention: "border-jcyan/40 bg-jcyan/10 text-jcyan",
} as const;

/** What the UI gets back from a module run — never more than the server sent. */
export interface ModuleRunOutcome {
  status: "COMPLETED" | "FAILED" | "UNAVAILABLE";
  reused: boolean;
  error: string | null;
  count: number;
  durationMs: number | null;
}

/**
 * Shared client-side runner for the four analysis modules.
 *
 * Authentication, ownership checks, bounded context loading, untrusted-data
 * marking, provider calls, strict validation and grounding all happen inside
 * the Convex action. The UI only triggers the run and then re-reads the stored
 * row through `api.intelligence.getAnalysis` — it renders nothing it did not
 * receive from the server.
 */
export function useRunModule() {
  const threat = useAction(api.intelligenceActions.threatAnalysisAction);
  const prediction = useAction(api.intelligenceActions.predictionAction);
  const correlation = useAction(api.intelligenceActions.correlationSuggestAction);
  const report = useAction(api.intelligenceActions.reportAssistAction);

  return async (
    module: AiModuleKey,
    caseId: string,
    force = false,
  ): Promise<ModuleRunOutcome> => {
    try {
      const res =
        module === "threat"
          ? await threat({ caseId, force })
          : module === "prediction"
            ? await prediction({ caseId, force })
            : module === "correlation"
              ? await correlation({ caseId, force })
              : await report({ caseId, force });
      return {
        status: res.status,
        reused: res.reused,
        error: res.error,
        count: res.count,
        durationMs: res.durationMs ?? null,
      };
    } catch (err) {
      return {
        status: "FAILED",
        reused: false,
        error: err instanceof Error ? err.message : "action error",
        count: 0,
        durationMs: null,
      };
    }
  };
}
