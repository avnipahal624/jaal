/**
 * JAAL INTELLIGENCE ENGINE — output schemas and grounding validation.
 *
 * Every model response is parsed with a strict zod schema, then GROUNDED:
 * references must resolve through the case's alias index (M<n>/E<k>/T<t>)
 * and quoted excerpts must appear verbatim (modulo whitespace/case) in the
 * referenced stored message. Anything unsupported is dropped here — the
 * backend never trusts a model-generated identifier as proof a record exists.
 *
 * All functions are pure so they can be unit-tested with mocked provider
 * payloads without any database or network.
 */
import { z } from "zod";
import {
  CONFIDENCE_LABELS,
  quoteMatches,
  resolveAlias,
  SEVERITIES,
  type CaseAliasIndex,
  type ConfidenceLabel,
  type Severity,
} from "./intelligence";

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

const aliasRef = z.string().min(1).max(8);
const shortText = z.string().min(1).max(400);
const longText = z.string().min(1).max(1_200);
const limitationText = z.string().min(1).max(300);

const messageRef = z.object({
  /** Alias of an existing message in THIS case (M<n>). */
  alias: aliasRef,
  /** Exact excerpt from that message — dropped when it does not match. */
  quote: z.string().min(4).max(400),
});

// ---------------------------------------------------------------------------
// Module 1 — Threat Intelligence Analyst
// ---------------------------------------------------------------------------

export const THREAT_OUTPUT_SCHEMA = z.object({
  overview: longText,
  findings: z
    .array(
      z.object({
        category: z.enum([
          "SOCIAL_ENGINEERING",
          "PSYCHOLOGICAL_MANIPULATION",
          "FINANCIAL_MANIPULATION",
          "INFORMATION_EXTRACTION",
          "CONVERSATION_BEHAVIOUR",
        ]),
        tactic: shortText,
        severity: z.string().max(20),
        explanation: longText,
        messageRefs: z.array(messageRef).min(1).max(6),
        confidence: z.string().max(20),
        recommendedAction: z.string().max(400),
        limitations: z.array(limitationText).max(4),
      }),
    )
    .max(20),
  insights: z.array(shortText).max(6),
  recommendedSteps: z.array(shortText).max(8),
});

export type ThreatOutput = z.infer<typeof THREAT_OUTPUT_SCHEMA>;

export interface GroundingOutcome<T> {
  output: T;
  /** References the model produced that were rejected as unsupported. */
  droppedRefs: number;
  /** Findings removed entirely because no valid reference remained. */
  droppedFindings: number;
}

function groundMessageRefs(
  refs: { alias: string; quote: string }[],
  index: CaseAliasIndex,
  messageTextById: Map<string, string>,
): { resolved: { id: string; quote: string }[]; dropped: number } {
  const resolved: { id: string; quote: string }[] = [];
  let dropped = 0;
  for (const ref of refs) {
    const hit = resolveAlias(index, ref.alias);
    if (!hit || hit.kind !== "message") {
      dropped += 1;
      continue;
    }
    const text = messageTextById.get(hit.id);
    if (!text || !quoteMatches(text, ref.quote)) {
      dropped += 1;
      continue;
    }
    resolved.push({ id: hit.id, quote: ref.quote });
  }
  return { resolved, dropped };
}

/**
 * Ground a validated threat analysis: resolve+verify every finding's message
 * references, drop findings that end up unsupported, and count what went.
 */
export function groundThreat(
  parsed: ThreatOutput,
  index: CaseAliasIndex,
): GroundingOutcome<{
  overview: string;
  findings: Array<{
    id: string;
    category: ThreatOutput["findings"][number]["category"];
    tactic: string;
    severity: Severity;
    explanation: string;
    confidence: ConfidenceLabel;
    recommendedAction: string;
    limitations: string[];
    messageRefs: { messageId: string; quote: string; n: number }[];
  }>;
  insights: string[];
  recommendedSteps: string[];
}> {
  const messageTextById = new Map(index.messages.map((m) => [m.id, m.text]));
  const numberById = new Map(index.messages.map((m) => [m.id, m.n]));
  const findings: ReturnType<typeof groundThreat>["output"]["findings"] = [];
  let droppedRefs = 0;
  let droppedFindings = 0;

  parsed.findings.forEach((f, i) => {
    const { resolved, dropped } = groundMessageRefs(
      f.messageRefs,
      index,
      messageTextById,
    );
    droppedRefs += dropped;
    if (resolved.length === 0) {
      droppedFindings += 1;
      return;
    }
    findings.push({
      id: `F${i + 1}`,
      category: f.category,
      tactic: f.tactic,
      severity: normalizeThreatSeverity(f.severity),
      explanation: f.explanation,
      confidence: normalizeLabel(f.confidence),
      recommendedAction: f.recommendedAction,
      limitations: f.limitations,
      messageRefs: resolved.map((r) => ({
        messageId: r.id,
        quote: r.quote,
        n: numberById.get(r.id) ?? 0,
      })),
    });
  });

  return {
    output: {
      overview: parsed.overview,
      findings,
      insights: parsed.insights,
      recommendedSteps: parsed.recommendedSteps,
    },
    droppedRefs,
    droppedFindings,
  };
}

function normalizeThreatSeverity(raw: string): Severity {
  const s = raw.trim().toUpperCase();
  if (s === "CRITICAL") return "CRITICAL";
  if (s === "HIGH") return "HIGH";
  if (s === "MEDIUM" || s === "MODERATE") return "MEDIUM";
  return "LOW";
}

function normalizeLabel(raw: string): ConfidenceLabel {
  const s = raw.trim().toLowerCase();
  if (CONFIDENCE_LABELS.includes(s as ConfidenceLabel)) return s as ConfidenceLabel;
  if (s.startsWith("high")) return "high";
  if (s.startsWith("medium") || s.startsWith("mod")) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Module 2 — Intent & Behaviour Prediction
// ---------------------------------------------------------------------------

export const PREDICTION_OUTPUT_SCHEMA = z.object({
  insufficientInformation: z.boolean(),
  currentStrategy: z.string().max(400),
  predictions: z
    .array(
      z.object({
        action: shortText,
        category: z.enum([
          "MONEY_REQUEST",
          "OTP_REQUEST",
          "IDENTITY_DOCUMENT",
          "SUSPICIOUS_LINK",
          "LEGAL_THREAT",
          "URGENCY_ESCALATION",
          "NEW_AUTHORITY",
          "REMOTE_ACCESS",
          "CREDENTIAL_THEFT",
          "REPETITION",
          "OTHER",
        ]),
        explanation: longText,
        messageRefs: z.array(messageRef).min(1).max(6),
        confidence: z.string().max(20),
        risk: z.string().max(20),
        suggestedResponse: z.string().max(400),
        uncertainty: z.string().max(400),
      }),
    )
    .max(8),
  indicators: z
    .array(z.object({ label: shortText, level: z.string().max(20) }))
    .max(8),
});

export type PredictionOutput = z.infer<typeof PREDICTION_OUTPUT_SCHEMA>;

export function groundPrediction(
  parsed: PredictionOutput,
  index: CaseAliasIndex,
): GroundingOutcome<{
  insufficientInformation: boolean;
  currentStrategy: string;
  predictions: Array<{
    id: string;
    action: string;
    category: PredictionOutput["predictions"][number]["category"];
    explanation: string;
    confidence: ConfidenceLabel;
    risk: Severity;
    suggestedResponse: string;
    uncertainty: string;
    messageRefs: { messageId: string; quote: string; n: number }[];
  }>;
  indicators: { label: string; level: Severity }[];
}> {
  const messageTextById = new Map(index.messages.map((m) => [m.id, m.text]));
  const numberById = new Map(index.messages.map((m) => [m.id, m.n]));
  const predictions: ReturnType<typeof groundPrediction>["output"]["predictions"] = [];
  let droppedRefs = 0;
  let droppedFindings = 0;

  parsed.predictions.forEach((p, i) => {
    const { resolved, dropped } = groundMessageRefs(
      p.messageRefs,
      index,
      messageTextById,
    );
    droppedRefs += dropped;
    if (resolved.length === 0) {
      droppedFindings += 1;
      return;
    }
    predictions.push({
      id: `P${i + 1}`,
      action: p.action,
      category: p.category,
      explanation: p.explanation,
      confidence: normalizeLabel(p.confidence),
      risk: normalizeThreatSeverity(p.risk),
      suggestedResponse: p.suggestedResponse,
      uncertainty: p.uncertainty,
      messageRefs: resolved.map((r) => ({
        messageId: r.id,
        quote: r.quote,
        n: numberById.get(r.id) ?? 0,
      })),
    });
  });

  return {
    output: {
      insufficientInformation: parsed.insufficientInformation,
      currentStrategy: parsed.currentStrategy,
      predictions,
      indicators: parsed.indicators.map((x) => ({
        label: x.label,
        level: normalizeThreatSeverity(x.level),
      })),
    },
    droppedRefs,
    droppedFindings,
  };
}

// ---------------------------------------------------------------------------
// Module 3 — Investigation Copilot
// ---------------------------------------------------------------------------

export const COPILOT_OUTPUT_SCHEMA = z.object({
  answer: z.string().min(1).max(2_000),
  points: z
    .array(
      z.object({
        text: z.string().min(1).max(400),
        messageRefs: z.array(messageRef).max(6).default([]),
        evidenceRefs: z.array(aliasRef).max(6).default([]),
      }),
    )
    .max(10)
    .default([]),
  uncertainty: z.string().max(400).default(""),
  suggestedNextStep: z.string().max(400).default(""),
  sufficient: z.boolean().default(true),
});

export type CopilotOutput = z.infer<typeof COPILOT_OUTPUT_SCHEMA>;

export function groundCopilot(
  parsed: CopilotOutput,
  index: CaseAliasIndex,
): GroundingOutcome<{
  answer: string;
  uncertainty: string;
  suggestedNextStep: string;
  sufficient: boolean;
  points: Array<{
    text: string;
    messageRefs: { messageId: string; quote: string; n: number }[];
    evidenceRefs: { evidenceId: string; alias: string }[];
  }>;
}> {
  const messageTextById = new Map(index.messages.map((m) => [m.id, m.text]));
  const numberById = new Map(index.messages.map((m) => [m.id, m.n]));
  const evidenceAliasById = new Map(index.evidence.map((e) => [e.id, e.alias]));
  let droppedRefs = 0;
  let droppedFindings = 0;

  const points = parsed.points.map((p) => {
    const { resolved, dropped } = groundMessageRefs(
      p.messageRefs,
      index,
      messageTextById,
    );
    droppedRefs += dropped;
    const evidenceRefs: { evidenceId: string; alias: string }[] = [];
    for (const alias of p.evidenceRefs) {
      const hit = resolveAlias(index, alias);
      if (!hit || hit.kind !== "indicator") {
        droppedRefs += 1;
        continue;
      }
      evidenceRefs.push({
        evidenceId: hit.id,
        alias: evidenceAliasById.get(hit.id) ?? alias,
      });
    }
    // A point citing nothing at all is dropped — answers must stay grounded.
    if (resolved.length === 0 && evidenceRefs.length === 0 && p.messageRefs.length + p.evidenceRefs.length > 0) {
      droppedFindings += 1;
      return null;
    }
    if (p.messageRefs.length + p.evidenceRefs.length === 0) {
      // Uncited but also making no citation claim — keep as general prose.
      return { text: p.text, messageRefs: [], evidenceRefs: [] };
    }
    return {
      text: p.text,
      messageRefs: resolved.map((r) => ({
        messageId: r.id,
        quote: r.quote,
        n: numberById.get(r.id) ?? 0,
      })),
      evidenceRefs,
    };
  });

  const kept = points.filter((p): p is NonNullable<typeof p> => p !== null);

  return {
    output: { ...parsed, points: kept },
    droppedRefs,
    droppedFindings,
  };
}

// ---------------------------------------------------------------------------
// Module 4 — Evidence Correlation
// ---------------------------------------------------------------------------

export const CORRELATION_OUTPUT_SCHEMA = z.object({
  suggestions: z
    .array(
      z.object({
        sourceAlias: aliasRef,
        targetAlias: aliasRef,
        relation: z.enum([
          "REPEATED_IDENTIFIER",
          "SHARED_TACTIC",
          "PAYMENT_TACTIC",
          "CROSS_CHANNEL_PATTERN",
          "CONTEXTUAL_LINK",
        ]),
        category: shortText,
        explanation: z.string().min(1).max(600),
        messageAliases: z.array(aliasRef).max(6).default([]),
        evidenceAliases: z.array(aliasRef).max(6).default([]),
        confidence: z.string().max(20),
      }),
    )
    .max(15),
});

export type CorrelationOutput = z.infer<typeof CORRELATION_OUTPUT_SCHEMA>;

export interface GroundedSuggestion {
  source: { kind: "indicator" | "message" | "tactic"; id: string; label: string };
  target: { kind: "indicator" | "message" | "tactic"; id: string; label: string };
  relation: CorrelationOutput["suggestions"][number]["relation"];
  category: string;
  explanation: string;
  messageRefs: string[];
  evidenceRefs: string[];
  confidence: ConfidenceLabel;
}

function labelFor(
  index: CaseAliasIndex,
  kind: "indicator" | "message" | "tactic",
  id: string,
): string {
  if (kind === "message") {
    const m = index.messages.find((x) => x.id === id);
    return m ? `MSG #${m.n}` : "message";
  }
  if (kind === "indicator") {
    const e = index.evidence.find((x) => x.id === id);
    return e ? `${e.label}: ${e.value}` : "indicator";
  }
  const t = index.tactics.find((x) => x.id === id);
  return t ? t.tactic : "tactic";
}

/**
 * Ground correlation suggestions: both endpoints must resolve inside the
 * case, must differ, and supporting references must resolve. Unsupported
 * suggestions are dropped entirely.
 */
export function groundCorrelation(
  parsed: CorrelationOutput,
  index: CaseAliasIndex,
): GroundingOutcome<GroundedSuggestion[]> {
  const suggestions: GroundedSuggestion[] = [];
  let droppedRefs = 0;
  let droppedFindings = 0;

  for (const s of parsed.suggestions) {
    const src = resolveAlias(index, s.sourceAlias);
    const dst = resolveAlias(index, s.targetAlias);
    if (!src || !dst || src.id === dst.id) {
      droppedFindings += 1;
      continue;
    }
    const messageRefs: string[] = [];
    for (const alias of s.messageAliases) {
      const hit = resolveAlias(index, alias);
      if (hit && hit.kind === "message") messageRefs.push(hit.id);
      else droppedRefs += 1;
    }
    const evidenceRefs: string[] = [];
    for (const alias of s.evidenceAliases) {
      const hit = resolveAlias(index, alias);
      if (hit && hit.kind === "indicator") evidenceRefs.push(hit.id);
      else droppedRefs += 1;
    }
    suggestions.push({
      source: {
        kind: src.kind,
        id: src.id,
        label: labelFor(index, src.kind, src.id),
      },
      target: {
        kind: dst.kind,
        id: dst.id,
        label: labelFor(index, dst.kind, dst.id),
      },
      relation: s.relation,
      category: s.category,
      explanation: s.explanation,
      messageRefs,
      evidenceRefs,
      confidence: normalizeLabel(s.confidence),
    });
  }

  return { output: suggestions, droppedRefs, droppedFindings };
}

// ---------------------------------------------------------------------------
// Module 5 — Forensic Report Assistant (narrative sections only)
// ---------------------------------------------------------------------------

export const REPORT_OUTPUT_SCHEMA = z.object({
  overview: z.string().min(1).max(1_600),
  incidentSummary: z.string().min(1).max(1_600),
  scope: z.string().min(1).max(800),
  conversationAnalysis: z.string().min(1).max(1_600),
  behaviourAnalysis: z.string().min(1).max(1_600),
  recommendations: z.array(shortText).min(1).max(8),
  limitations: z.array(limitationText).min(1).max(8),
});

export type ReportOutput = z.infer<typeof REPORT_OUTPUT_SCHEMA>;

// ---------------------------------------------------------------------------
// Severity summary (shared UI helpers server-side)
// ---------------------------------------------------------------------------

export function severityCounts(severities: Severity[]): Record<Severity, number> {
  const out: Record<Severity, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const s of severities) out[s] += 1;
  return out;
}

export { SEVERITIES };
