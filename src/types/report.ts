import type { ScamCategory, KillChainStageId, TacticId } from "./investigation";

export interface ReportEvidenceRow {
  id: string;
  type: string;
  label: string;
  value: string;
  extractedAt: number;
  hash: string | null;
  hashStatus: string;
}

export interface ReportIntegritySummary {
  collected: number;
  hashed: number;
  verified: number;
  mismatched: number;
  unhashed: number;
}

export interface EvidenceReport {
  id: string;
  caseId: string;
  title: string;
  category: ScamCategory;
  generatedAt: number;
  generatedBy: string;
  /** Always true for locally generated demo reports */
  simulated: boolean;
  status: "active" | "completed" | "archived";
  currentStage: KillChainStageId;
  evidenceCount: number;
  integrity: ReportIntegritySummary;
  description: string;
  transcript: {
    author: string;
    text: string;
    timestamp: number;
  }[];
  tactics: {
    tactic: TacticId;
    name: string;
    timestamp: number;
    sourceText: string;
    explanation: string;
  }[];
  stages: {
    id: KillChainStageId;
    number: number;
    label: string;
    status: string;
    detectedAt: number | null;
    reason: string;
  }[];
  evidence: ReportEvidenceRow[];
  timeline: {
    timestamp: number;
    kind: string;
    title: string;
    detail: string;
  }[];
  verification: {
    id: string;
    label: string;
    hash: string | null;
    status: string;
    note: string;
  }[];
  analystNotes: string;
}
