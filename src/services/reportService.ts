import { TACTIC_META } from "@/services/investigationService";
import { buildCaseSummary, buildUnknowns } from "@/services/summaryService";
import type { CaseRuntime, Investigation } from "@/types/investigation";
import type { EvidenceReport } from "@/types/report";
import { downloadJson } from "@/utils/export";

/** Build a structured evidence report from live investigation state. */
export function buildReport(
  investigation: Investigation,
  runtime: CaseRuntime,
  generatedBy: string,
  now = Date.now(),
): EvidenceReport {
  const integrity = runtime.evidence.reduce(
    (acc, item) => {
      acc.collected += 1;
      if (item.hashStatus === "generated" || item.hashStatus === "verified" || item.hashStatus === "mismatch")
        acc.hashed += 1;
      if (item.hashStatus === "verified") acc.verified += 1;
      if (item.hashStatus === "mismatch") acc.mismatched += 1;
      if (item.hashStatus === "none") acc.unhashed += 1;
      return acc;
    },
    { collected: 0, hashed: 0, verified: 0, mismatched: 0, unhashed: 0 },
  );

  const messageNumbers: Record<string, number> = {};
  runtime.messages.forEach((m, i) => {
    messageNumbers[m.id] = i + 1;
  });

  return {
    id: `RPT-${investigation.id.replace("JAAL-", "")}-${now.toString(36).toUpperCase().slice(-5)}`,
    caseId: investigation.id,
    title: investigation.title,
    category: investigation.category,
    generatedAt: now,
    generatedBy,
    simulated: true,
    status: investigation.status,
    currentStage: runtime.stages.find((s) => s.status === "active")?.id ?? investigation.currentStage,
    evidenceCount: runtime.evidence.length,
    integrity,
    description: investigation.description,
    summary: buildCaseSummary(investigation, runtime),
    unknowns: buildUnknowns(investigation, runtime),
    transcript: runtime.messages.map((m) => ({
      author: m.author,
      text: m.text,
      timestamp: m.timestamp,
    })),
    tactics: runtime.tactics.map((t) => ({
      tactic: t.tactic,
      name: TACTIC_META[t.tactic].name,
      timestamp: t.timestamp,
      sourceText: t.sourceText,
      explanation: t.explanation,
      messageId: t.messageId ?? null,
      messageNumber:
        t.messageId != null ? (messageNumbers[t.messageId] ?? null) : null,
    })),
    stages: runtime.stages.map((s) => ({
      id: s.id,
      number: s.number,
      label: s.label,
      status: s.status,
      detectedAt: s.detectedAt,
      reason: s.reason,
    })),
    evidence: runtime.evidence.map((e) => ({
      id: e.id,
      type: e.type,
      label: e.label,
      value: e.value,
      extractedAt: e.extractedAt,
      hash: e.hash,
      hashStatus: e.hashStatus,
      review: {
        status: e.reviewStatus ?? null,
        note: e.reviewNote ?? null,
        reviewedAt: e.reviewedAt ?? null,
      },
      sourceMessageId: e.sourceMessageId ?? null,
      sourceMessageNumber:
        e.sourceMessageId != null
          ? (messageNumbers[e.sourceMessageId] ?? null)
          : null,
    })),
    timeline: runtime.activities.map((a) => ({
      timestamp: a.timestamp,
      kind: a.kind,
      title: a.title,
      detail: a.detail,
    })),
    verification: runtime.evidence.map((e) => ({
      id: e.id,
      label: `${e.label}: ${e.value}`,
      hash: e.hash,
      status: e.hashStatus,
      note:
        e.hashStatus === "verified"
          ? "Content matches the recorded hash. This confirms content integrity only — not authenticity."
          : e.hashStatus === "mismatch"
            ? "Content no longer matches the recorded hash."
            : e.hashStatus === "generated"
              ? "Hash recorded. Run verification to compare content against it."
              : "Evidence collected. No hash recorded yet.",
    })),
    analystNotes:
      investigation.notes ||
      "No analyst notes recorded. All identifiers in this report are synthetic demo values extracted from a controlled simulation.",
  };
}

export function exportReportJson(report: EvidenceReport): void {
  downloadJson(
    `${report.id}_${report.caseId}.json`.toLowerCase(),
    {
      ...report,
      disclaimer:
        "SIMULATED REPORT — generated from a controlled JAAL demo conversation. Hashes verify content integrity only; they do not establish authenticity, guilt or legal admissibility.",
    },
  );
}

/** Trigger the browser print dialog for the printable report view. */
export function printReport(): void {
  window.print();
}
