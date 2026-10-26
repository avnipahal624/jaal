/**
 * JAAL backend helpers shared by the Convex functions.
 *
 * The analysis pipeline is the SAME rule-based engine the frontend uses
 * (src/services/*), reused here as the single server-side processing path:
 * message → tactic detection → identifier extraction → evidence + SHA-256
 * → kill-chain update → strategy → activity events. Nothing here fabricates
 * findings: every detection is derived from actual message content.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type {
  DatabaseReader,
  DatabaseWriter,
} from "../_generated/server";
import {
  analyzeMessage,
  createStages,
  currentStageId,
  STAGE_LABELS,
  TACTIC_META,
} from "@/services/investigationService";
import { toEvidenceItem } from "@/services/evidenceService";
import { buildStrategy } from "@/services/strategyService";
import { sha256Hex } from "@/utils/hash";
import { DEFAULT_SETTINGS, type Settings } from "@/types/settings";
import type {
  ActivityEvent,
  CaseRuntime,
  Investigation,
  KillChainStage,
  LogEntry,
} from "@/types/investigation";
import type { ConversationMessage } from "@/types/message";
import type { EvidenceItem } from "@/types/evidence";
import type { EvidenceReport } from "@/types/report";

export const SCHEMA_VERSION = 1;
export const MAX_LOG_DOCS = 400;
export const MAX_EVENT_DOCS = 250;

export function rid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Resolve the authenticated owner. Local demo sessions must never become a
 * shared backend identity: the demo experience runs entirely in local state. */
export async function getOwner(ctx: {
  auth: { getUserIdentity(): Promise<{ subject: string } | null> };
}): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new Error("Authentication required. Sign in to use the shared backend.");
  }
  return identity.subject;
}

// ---------------------------------------------------------------------------
// Doc → frontend type mappers (the frontend types are the wire contract).
// ---------------------------------------------------------------------------

const HASH_STATUS_MAP = {
  NOT_HASHED: "none",
  HASH_GENERATED: "generated",
  INTEGRITY_VERIFIED: "verified",
  HASH_MISMATCH: "mismatch",
} as const;

export function docToMessage(
  doc: Doc<"messages">,
  caseId: string,
): ConversationMessage {
  return {
    id: doc._id,
    caseId,
    author: doc.sender,
    text: doc.content,
    timestamp: doc.timestamp,
    source: doc.source,
    status: doc.status,
  };
}

export function docToEvidence(doc: Doc<"evidence">): EvidenceItem {
  return {
    id: doc._id,
    caseId: doc.caseId,
    type: doc.evidenceType as EvidenceItem["type"],
    label: doc.label,
    value: doc.extractedValue,
    content: doc.content,
    sourceMessageId: doc.sourceMessageId ?? null,
    sourceMessageText: doc.sourceMessageText,
    extractedAt: doc.extractionTimestamp,
    notes: doc.notes,
    hash: doc.integrityHash ?? null,
    hashGeneratedAt: doc.hashGeneratedAt ?? null,
    hashStatus: HASH_STATUS_MAP[doc.integrityStatus],
    tampered: doc.tampered,
    reviewStatus: doc.reviewStatus ?? null,
    reviewNote: doc.reviewNote ?? null,
    reviewedAt: doc.reviewedAt ?? null,
  };
}

export function docToActivity(doc: Doc<"events">): ActivityEvent {
  return {
    id: doc._id,
    caseId: doc.caseId,
    timestamp: doc.timestamp,
    kind: doc.kind as ActivityEvent["kind"],
    title: doc.title,
    detail: doc.detail,
  };
}

export function docToLog(doc: Doc<"logs">): LogEntry {
  return {
    id: doc._id,
    caseId: doc.caseId,
    timestamp: doc.timestamp,
    level: doc.level as LogEntry["level"],
    message: doc.message,
  };
}

export function docToInvestigation(doc: Doc<"investigations">): Investigation {
  return {
    id: doc.caseId,
    title: doc.title,
    category: doc.category as Investigation["category"],
    description: doc.description,
    notes: doc.notes,
    status: doc.status,
    createdAt: doc.createdAt,
    lastActivityAt: doc.lastActivityAt,
    currentStage: doc.currentStage as Investigation["currentStage"],
    source: doc.source,
    detectionMode: doc.detectionMode,
    flags: doc.flags,
  };
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

export async function pushLog(
  db: DatabaseWriter,
  inv: Doc<"investigations">,
  level: LogEntry["level"],
  message: string,
  at = Date.now(),
) {
  await db.insert("logs", {
    investigationId: inv._id,
    owner: inv.owner,
    caseId: inv.caseId,
    level,
    message,
    timestamp: at,
  });
}

export async function pushEvent(
  db: DatabaseWriter,
  inv: Doc<"investigations">,
  kind: ActivityEvent["kind"],
  title: string,
  detail: string,
  at = Date.now(),
) {
  await db.insert("events", {
    investigationId: inv._id,
    owner: inv.owner,
    caseId: inv.caseId,
    kind,
    title,
    detail,
    timestamp: at,
  });
}

/** Keep log/event tables bounded (oldest trimmed past the caps). */
export async function capTable(
  db: DatabaseWriter,
  inv: Doc<"investigations">,
  table: "logs" | "events",
  max: number,
) {
  const total = await db
    .query(table)
    .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
    .collect();
  if (total.length <= max) return;
  const excess = total
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, total.length - max);
  for (const doc of excess) await db.delete(doc._id);
}

// ---------------------------------------------------------------------------
// Central message pipeline
// ---------------------------------------------------------------------------

export interface IngestResult {
  /** True when the kill-chain advanced on this message. */
  stageChanged: boolean;
  stageAfter: string;
  newEvidenceIds: Id<"evidence">[];
}

/**
 * Run the analysis pipeline for one freshly inserted message:
 * tactics → identifiers → evidence (deduped, hashed) → kill-chain → analyses →
 * logs/events. This is the ONLY place message processing happens on the
 * backend; routes and controllers delegate here.
 */
export async function processMessage(
  db: DatabaseWriter,
  inv: Doc<"investigations">,
  messageDoc: Doc<"messages">,
  opts: { autoExtract: boolean; autoHash: boolean },
): Promise<IngestResult> {
  const caseId = inv.caseId;
  const message = docToMessage(messageDoc, caseId);

  const tacticDocs = await db
    .query("tactics")
    .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
    .collect();
  const existingTactics = tacticDocs.map((t) => ({
    id: `${t.tactic}:${t.messageId ?? "case"}`,
    caseId,
    tactic: t.tactic as never,
    messageId: t.messageId ?? null,
    sourceText: t.sourceText,
    timestamp: t.timestamp,
    explanation: t.explanation,
  }));

  const stages = (inv.stages as KillChainStage[] | null) ?? createStages();
  const analysis = analyzeMessage(message, existingTactics, stages, {
    tacticDetection: inv.flags.tacticDetection,
    identifierExtraction: inv.flags.identifierExtraction && opts.autoExtract,
    at: message.timestamp,
  });

  const newEvidenceIds: Id<"evidence">[] = [];
  const evidenceDocs = await db
    .query("evidence")
    .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
    .collect();

  for (const draft of analysis.evidence) {
    const dup = evidenceDocs.some(
      (e) =>
        e.evidenceType === draft.type &&
        e.extractedValue.toLowerCase() === draft.value.toLowerCase(),
    );
    if (dup) continue;

    // Deterministic snapshot — the exact bytes that get hashed.
    const item = toEvidenceItem(caseId, draft, {
      messageId: messageDoc._id,
      messageText: messageDoc.content,
    }, message.timestamp);

    let integrityHash: string | undefined;
    let hashGeneratedAt: number | undefined;
    if (inv.flags.integrityHashing && opts.autoHash) {
      integrityHash = await sha256Hex(item.content);
      hashGeneratedAt = Date.now();
    }

    const evidenceId = await db.insert("evidence", {
      investigationId: inv._id,
      owner: inv.owner,
      caseId,
      sourceMessageId: messageDoc._id,
      sourceMessageText: messageDoc.content,
      label: item.label,
      evidenceType: draft.type,
      extractedValue: draft.value,
      normalizedValue: draft.value.toLowerCase(),
      content: item.content,
      extractionMethod: "RULE_BASED_REGEX",
      extractionTimestamp: message.timestamp,
      integrityHash,
      integrityAlgorithm: integrityHash ? "SHA-256" : undefined,
      integrityStatus: integrityHash ? "HASH_GENERATED" : "NOT_HASHED",
      hashGeneratedAt,
      notes: item.notes,
      createdAt: message.timestamp,
    });
    newEvidenceIds.push(evidenceId);

    await pushEvent(
      db,
      inv,
      "identifier_extracted",
      `${draft.label} extracted`,
      draft.value,
      message.timestamp,
    );
    if (integrityHash) {
      await pushEvent(
        db,
        inv,
        "hash_generated",
        "Evidence hash generated",
        `${draft.label}: ${draft.value}`,
        hashGeneratedAt,
      );
      await pushLog(
        db,
        inv,
        "success",
        `SHA-256 hash generated · ${draft.label}`,
        hashGeneratedAt,
      );
    }
  }

  const stageBefore = currentStageId(stages);
  const stageAfter = currentStageId(analysis.stages);
  const stageChanged =
    message.author === "scammer" && stageAfter !== stageBefore;

  // Tactics + analyses rows
  for (const tactic of analysis.tactics) {
    const exists = tacticDocs.some(
      (t) => t.tactic === tactic.tactic && t.messageId === messageDoc._id,
    );
    if (exists) continue;
    await db.insert("tactics", {
      investigationId: inv._id,
      owner: inv.owner,
      caseId,
      tactic: tactic.tactic,
      messageId: messageDoc._id,
      sourceText: tactic.sourceText,
      timestamp: tactic.timestamp,
      explanation: tactic.explanation,
    });
    await pushEvent(
      db,
      inv,
      "tactic_detected",
      `Tactic detected: ${TACTIC_META[tactic.tactic].name}`,
      tactic.explanation,
      tactic.timestamp,
    );
  }

  if (message.author === "scammer") {
    const tacticIds = analysis.tactics.map((t) => t.tactic);
    await db.insert("analyses", {
      investigationId: inv._id,
      owner: inv.owner,
      messageId: messageDoc._id,
      intent: classifyIntentSafe(tacticIds, stageAfter),
      tactics: analysis.tactics.map((t) => ({
        tacticCode: t.tactic,
        displayName: TACTIC_META[t.tactic].name,
        explanation: t.explanation,
        supportingText: t.sourceText,
        supportingMessageId: messageDoc._id,
        detectionMethod: "RULE_BASED",
      })),
      summary: `Message #${messageDoc.messageNumber} matched ${
        analysis.tactics.length
      } tactic pattern(s).`,
      reasoningSummary: analysis.tactics
        .map((t) => t.explanation)
        .join(" · "),
      engineMode: "RULE_BASED",
      createdAt: message.timestamp,
    });
  }

  // Logs from the engine (message received / tactic / identifier / stage)
  for (const log of analysis.logs) {
    await pushLog(db, inv, log.level, log.message, log.timestamp);
  }

  if (stageChanged) {
    const reason =
      analysis.stages.find((s) => s.id === stageAfter)?.reason ?? "";
    await pushEvent(
      db,
      inv,
      "stage_advanced",
      `Stage reached: ${STAGE_LABELS[stageAfter as never]}`,
      reason,
      message.timestamp,
    );
    await pushLog(
      db,
      inv,
      "warn",
      `Kill-chain stage: ${STAGE_LABELS[stageAfter as never]}`,
      message.timestamp,
    );
  }

  // Persist kill-chain + stage progress on the investigation.
  await db.patch(inv._id, {
    stages: analysis.stages,
    lastActivityAt: Math.max(inv.lastActivityAt, message.timestamp),
    ...(message.author === "scammer"
      ? { currentStage: stageAfter }
      : {}),
  });

  await capTable(db, inv, "logs", MAX_LOG_DOCS);
  await capTable(db, inv, "events", MAX_EVENT_DOCS);

  return { stageChanged, stageAfter, newEvidenceIds };
}

function classifyIntentSafe(
  tactics: string[],
  stage: string,
): string {
  // Local mirror of the frontend intent labels — keep in sync with
  // strategyService.classifyIntent.
  if (tactics.includes("payment_request")) return "PAYMENT PRESSURE";
  if (tactics.includes("fear_threat")) return "FEAR / THREAT";
  if (tactics.includes("authority_impersonation")) return "AUTHORITY CLAIM";
  if (tactics.includes("remote_access")) return "DEVICE ACCESS";
  if (tactics.includes("isolation")) return "ISOLATION";
  if (tactics.includes("urgency")) return "URGENCY";
  switch (stage) {
    case "payment":
      return "PAYMENT PRESSURE";
    case "fear":
      return "FEAR / THREAT";
    case "authority":
      return "AUTHORITY CLAIM";
    case "exploit":
      return "EXPLOITATION";
    default:
      return "CONTACT / PRETEXT";
  }
}

// ---------------------------------------------------------------------------
// Strategy generation (rule-based fallback over real conversation state)
// ---------------------------------------------------------------------------

/**
 * Recompute the pending investigation strategy from the conversation and
 * store it. Supersedes any previous pending suggestion. Returns the doc.
 */
export async function refreshStrategy(
  db: DatabaseWriter,
  inv: Doc<"investigations">,
  engineOverride?: {
    objective: string;
    informationGap: string;
    suggestedQuestion: string;
    reason: string;
    engineMode: string;
  },
) {
  // Supersede existing pending suggestions.
  const pending = await db
    .query("strategies")
    .withIndex("by_investigation_status", (q) =>
      q.eq("investigationId", inv._id).eq("status", "pending"),
    )
    .collect();
  for (const doc of pending) {
    await db.patch(doc._id, { status: "superseded" });
  }

  const messages = await db
    .query("messages")
    .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
    .collect();
  const convo = messages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((m) => docToMessage(m, inv.caseId));
  const stages = (inv.stages as KillChainStage[] | null) ?? createStages();

  const runtimeLike = {
    caseId: inv.caseId,
    messages: convo,
    stages,
  } as unknown as CaseRuntime;

  const local = buildStrategy(runtimeLike);
  const suggestion = engineOverride ?? (local
    ? {
        objective: local.objective,
        informationGap: local.missing,
        suggestedQuestion: local.question,
        reason: local.reason,
        engineMode: "SIMULATION",
      }
    : null);

  if (!suggestion) {
    await db.insert("strategies", {
      investigationId: inv._id,
      owner: inv.owner,
      caseId: inv.caseId,
      objective: "",
      informationGap: "",
      suggestedQuestion: "",
      reason: "All knowledge goals covered — continue freely.",
      relatedMessageIds: [],
      engineMode: "SIMULATION",
      status: "exhausted",
      createdAt: Date.now(),
    });
    await pushLog(
      db,
      inv,
      "info",
      "AI analysis: strategy engine reports all knowledge goals covered",
    );
    return null;
  }

  const lastScammer = [...convo].reverse().find((m) => m.author === "scammer");
  const strategyDoc = await db.insert("strategies", {
    investigationId: inv._id,
    owner: inv.owner,
    caseId: inv.caseId,
    objective: suggestion.objective,
    informationGap: suggestion.informationGap,
    suggestedQuestion: suggestion.suggestedQuestion,
    reason: suggestion.reason,
    relatedMessageIds: lastScammer ? [lastScammer.id] : [],
    engineMode: suggestion.engineMode,
    status: "pending",
    createdAt: Date.now(),
  });
  await pushLog(
    db,
    inv,
    "info",
    `AI analysis: strategy generated (${suggestion.engineMode}) → “${suggestion.suggestedQuestion}”`,
  );
  return strategyDoc;
}

// ---------------------------------------------------------------------------
// Runtime assembly (used by the state query and report generation)
// ---------------------------------------------------------------------------

export async function buildRuntime(
  db: DatabaseReader | DatabaseWriter,
  inv: Doc<"investigations">,
): Promise<CaseRuntime> {
  const [messages, evidence, tactics, events, logs, strategies] = await Promise.all([
    db
      .query("messages")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .collect(),
    db
      .query("evidence")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .collect(),
    db
      .query("tactics")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .collect(),
    db
      .query("events")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .collect(),
    db
      .query("logs")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .collect(),
    db
      .query("strategies")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .collect(),
  ]);

  // Latest usable strategy suggestion: a pending one wins, otherwise the most
  // recent approved/exhausted one (Claude-authored when configured).
  const usable = strategies.filter(
    (s) => s.status === "pending" || s.status === "approved" || s.status === "exhausted",
  );
  const latestStrategy =
    usable.find((s) => s.status === "pending") ??
    [...usable].sort((a, b) => b.createdAt - a.createdAt)[0] ??
    null;

  const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  return {
    caseId: inv.caseId,
    messages: sortedMessages.map((m) => docToMessage(m, inv.caseId)),
    evidence: evidence.map(docToEvidence),
    tactics: tactics.map((t) => ({
      id: `${t.tactic}:${t.messageId ?? "case"}`,
      caseId: inv.caseId,
      tactic: t.tactic as never,
      messageId: t.messageId ?? null,
      sourceText: t.sourceText,
      timestamp: t.timestamp,
      explanation: t.explanation,
    })),
    stages: (inv.stages as KillChainStage[]) ?? createStages(),
    logs: [...logs]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-MAX_LOG_DOCS)
      .map(docToLog),
    activities: [...events]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-MAX_EVENT_DOCS)
      .map(docToActivity),
    cursor: inv.cursor,
    turnCount: inv.turnCount,
    status: inv.runStatus,
    startedAt: inv.startedAt,
    endedAt: inv.endedAt ?? null,
    typing: false,
    exhausted: inv.runStatus === "completed",
    strategy: latestStrategy
      ? {
          objective: latestStrategy.objective,
          missing: latestStrategy.informationGap,
          question: latestStrategy.suggestedQuestion,
          reason: latestStrategy.reason,
          source: latestStrategy.engineMode,
          approved: latestStrategy.status === "approved",
        }
      : null,
  };
}

export async function loadSettings(
  db: DatabaseReader | DatabaseWriter,
  owner: string,
): Promise<Settings> {
  const doc = await db
    .query("settings")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .unique();
  if (!doc) return DEFAULT_SETTINGS;
  return {
    appearance: { ...DEFAULT_SETTINGS.appearance, ...doc.appearance },
    investigation: { ...DEFAULT_SETTINGS.investigation, ...doc.investigation },
    simulation: { ...DEFAULT_SETTINGS.simulation, ...doc.simulation },
  } as Settings;
}

export type { Doc, Id, Settings, EvidenceReport, Investigation };
