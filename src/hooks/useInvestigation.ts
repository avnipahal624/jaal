import { useMemo } from "react";
import { useJaal } from "@/state/JaalProvider";
import type {
  ActivityEvent,
  CaseRuntime,
  Investigation,
} from "@/types/investigation";

/** Full case context (metadata + runtime) for one investigation. */
export function useInvestigation(caseId: string | undefined): {
  investigation: Investigation | null;
  runtime: CaseRuntime | null;
  activities: ActivityEvent[];
  evidenceCount: number;
} {
  const { state } = useJaal();
  return useMemo(() => {
    const investigation = caseId
      ? (state.investigations.find((i) => i.id === caseId) ?? null)
      : null;
    const runtime = caseId ? (state.sessions[caseId] ?? null) : null;
    return {
      investigation,
      runtime,
      activities: runtime ? [...runtime.activities].sort((a, b) => b.timestamp - a.timestamp) : [],
      evidenceCount: runtime?.evidence.length ?? 0,
    };
  }, [state.investigations, state.sessions, caseId]);
}
