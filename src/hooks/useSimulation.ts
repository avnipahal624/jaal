import { useCallback } from "react";
import { useJaal } from "@/state/JaalProvider";
import { SUGGESTED_PROMPTS } from "@/services/simulationService";

/** Conversation simulation controls for the active case. */
export function useSimulation(caseId: string | undefined) {
  const { state, sendMessage, togglePause, endInvestigation, resetCase, clearLogs } =
    useJaal();

  const runtime = caseId ? state.sessions[caseId] ?? null : null;

  const send = useCallback(
    (text: string) => {
      if (!caseId) return Promise.resolve();
      return sendMessage(caseId, text);
    },
    [caseId, sendMessage],
  );

  const pause = useCallback(() => caseId && togglePause(caseId), [caseId, togglePause]);
  const end = useCallback(
    () => caseId && endInvestigation(caseId),
    [caseId, endInvestigation],
  );
  const reset = useCallback(() => caseId && resetCase(caseId), [caseId, resetCase]);
  const clear = useCallback(() => caseId && clearLogs(caseId), [caseId, clearLogs]);

  return {
    runtime,
    isRunning: runtime?.status === "running",
    isPaused: runtime?.status === "paused",
    isCompleted: runtime?.status === "completed",
    isTyping: runtime?.typing ?? false,
    send,
    pause,
    end,
    reset,
    clearLogs: clear,
    suggestions: SUGGESTED_PROMPTS,
  };
}
