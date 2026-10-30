import { useAction } from "convex/react";
import { action } from "./_generated/server";
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
  try {
    const actionMap: Record<"threat" | "prediction" | "correlation" | "report", ActionBuilder<any, "public">> = {
      threat: api.intelligence.threatAnalysis,
      prediction: api.intelligence.prediction,
      correlation: api.intelligence.correlation,
      report: api.intelligence.reportAssist,
    };
    const fn = actionMap[module as keyof typeof actionMap];
    const actionRes = await useAction(fn as any)({ caseId, force: false });
    const base: Record<string, unknown> = actionRes ?? {};
    return {
      status: base.status === "COMPLETED" ? "COMPLETED" : base.status === "FAILED" ? "FAILED" : "UNAVAILABLE",
      error: typeof base.error === "string" ? base.error : null,
      limitations: Array.isArray(base.limitations) ? base.limitations : [],
      count: typeof base.count === "number" ? base.count : 0,
    };
  } catch (err: any) {
    return { status: "FAILED", error: err?.message ?? "action error", limitations: [], count: 0 };
  }
}
