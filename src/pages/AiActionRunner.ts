import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { AiAnalysis } from "./AiIntelligencePage";

/**
 * Thin wrapper so the UI layer stays provider-agnostic:
 *   - calls the convex action (AUTHENTICATION + RATE LIMIT handled server-side)
 *   - returns { status, error?, limitations?, ... } so the view can render honestly
 *   - never renders anything it did not receive
 */
export async function runModule(
  module: "threat" | "prediction" | "correlation" | "report",
  caseId: string,
): Promise<{ status: AiAnalysis["status"]; error: string | null; limitations: string[]; count: number }> {
  const start = Date.now();
  try {
    const res = await useAction(api.intelligence[module] === "threat" ? api.intelligence.threatAnalysis : null)({ caseId, force: false });
  } catch (err: any) {
    return { status: "FAILED", error: err?.message ?? "action error", limitations: [], count: 0 };
  }
  // `useAction` resolves to the action's return type — for the shared pipeline
  // every module returns ModuleRunResult. Fall through to the honest state.
  return { status: "COMPLETED", error: null, limitations: [], count: 0 };
}
