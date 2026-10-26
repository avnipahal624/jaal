/**
 * JAAL backend — investigation, conversation, evidence, report and settings
 * API implemented as Convex functions.
 *
 * Real-time updates: `state` is a reactive query, so every connected client
 * receives MESSAGE_RECEIVED / TACTIC_DETECTED / EVIDENCE_EXTRACTED /
 * HASH_GENERATED / KILLCHAIN_UPDATED / STRATEGY_GENERATED updates as soon as
 * a mutation commits — this replaces an SSE stream with Convex subscriptions.
 *
 * All case resources are scoped to the authenticated owner (identity subject,
 * or the shared "demo" owner for simulation logins); every mutation re-checks
 * ownership server-side and never trusts a client-claimed caseId alone.
 */
import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  buildRuntime,
  capTable,
  docToEvidence,
  docToInvestigation,
  docToMessage,
  getOwner,
  loadSettings,
  MAX_EVENT_DOCS,
  MAX_LOG_DOCS,
  processMessage,
  pushEvent,
  pushLog,
  refreshStrategy,
  rid,
  SCHEMA_VERSION,
} from "./lib/backend";
import {
  arcExhausted,
  nextScammerTurn,
} from "@/services/simulationService";
import { createStages } from "@/services/investigationService";
import { buildReport } from "@/services/reportService";
import { buildSeedCases } from "@/data/demoInvestigations";
import { OPENING_TURN } from "@/data/demoConversation";
import { sha256Hex } from "@/utils/hash";
import type { CaseRuntime, KillChainStage } from "@/types/investigation";
import type { EvidenceReport } from "@/types/report";

// ---------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------

async function requireOwner(ctx: QueryCtx | MutationCtx): Promise<string> {
  return getOwner(ctx);
}

/** Resolve a case for the caller — throws when not found or not owned. */
async function requireInvestigation(
  ctx: QueryCtx | MutationCtx,
  caseId: string,
): Promise<Doc<"investigations">> {
  const owner = await requireOwner(ctx);
  const doc = await ctx.db
    .query("investigations")
    .withIndex("by_owner_case", (q) =>
      q.eq("owner", owner).eq("caseId", caseId),
    )
    .unique();
  if (!doc) throw new Error(`Investigation ${caseId} not found`);
  return doc;
}

// ---------------------------------------------------------------------------
// Rate limiting — lightweight per-case guard on operator/simulation traffic.
// (The Convex deployment additionally provides platform-level rate limiting.)
const RATE_WINDOW_MS = 30_000;
const RATE_MAX_MESSAGES = 10;

async function enforceMessageRateLimit(
  db: MutationCtx["db"],
  inv: Doc<"investigations">,
): Promise<void> {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  // The timestamp index makes this a bounded range read instead of loading
  // the entire transcript for every rate-limit check.
  const recent = await db
    .query("messages")
    .withIndex("by_investigation_timestamp", (q) =>
      q.eq("investigationId", inv._id).gte("timestamp", cutoff),
    )
    .take(RATE_MAX_MESSAGES);
  const count = recent.length;
  if (count >= RATE_MAX_MESSAGES) {
    throw new Error(
      "Rate limit exceeded — wait a moment before sending more messages in this case.",
    );
  }
}

async function countMessages(
  db: MutationCtx["db"],
  inv: Doc<"investigations">,
): Promise<number> {
  // Message numbers are assigned monotonically on insertion. Read only
  // the latest row instead of scanning the full transcript on every message.
  const latest = await db
    .query("messages")
    .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
    .order("desc")
    .first();
  return latest?.messageNumber ?? 0;
}

function nextCaseId(existing: Doc<"investigations">[]): string {
  const max = existing.reduce((acc, inv) => {
    const n = Number(inv.caseId.split("-")[1]);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `JAAL-${String(max + 1).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Bounded live workspace snapshot. Full history remains in the database and
 * generated reports; this subscription hydrates the 50 most recently active
 * cases and recent per-case activity so reconnects cannot load unbounded data.
 */
export const state = query({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    // Keep the reactive bootstrap bounded. Case detail remains stored in full;
    // the workspace bootstrap loads the 50 most recently active cases.
    const invDocs = await ctx.db
      .query("investigations")
      .withIndex("by_owner_activity", (q) => q.eq("owner", owner))
      .order("desc")
      .take(50);

    const investigations = invDocs
      .map(docToInvestigation)
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt);

    const sessions: Record<string, CaseRuntime> = {};
    for (const inv of invDocs) {
      sessions[inv.caseId] = await buildRuntime(ctx.db, inv);
    }

    const reportDocs = await ctx.db
      .query("reports")
      .withIndex("by_owner_generated", (q) => q.eq("owner", owner))
      .order("desc")
      .take(50);
    const reports = reportDocs
      .map((d) => d.reportData as EvidenceReport)
      .sort((a, b) => b.generatedAt - a.generatedAt)
      .slice(0, 50);

    const settings = await loadSettings(ctx.db, owner);

    return { investigations, sessions, reports, settings };
  },
});

/** Dashboard statistics computed from the database (no random numbers). */
export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    const invDocs = await ctx.db
      .query("investigations")
      .withIndex("by_owner_activity", (q) => q.eq("owner", owner))
      .order("desc")
      .take(100);
    const reportDocs = await ctx.db
      .query("reports")
      .withIndex("by_owner_generated", (q) => q.eq("owner", owner))
      .order("desc")
      .take(100);

    let evidenceCount = 0;
    for (const inv of invDocs) {
      const items = await ctx.db
        .query("evidence")
        .withIndex("by_investigation", (q) =>
          q.eq("investigationId", inv._id),
        )
        .collect();
      evidenceCount += items.length;
    }

    const recent = invDocs
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
      .slice(0, 6)
      .map((d) => ({
        ...docToInvestigation(d),
        evidenceCount: 0,
      }));

    const recentEvents: {
      caseId: string;
      kind: string;
      title: string;
      detail: string;
      timestamp: number;
    }[] = [];
    for (const inv of invDocs) {
      const events = await ctx.db
        .query("events")
        .withIndex("by_investigation", (q) =>
          q.eq("investigationId", inv._id),
        )
        .collect();
      for (const e of events) {
        recentEvents.push({
          caseId: e.caseId,
          kind: e.kind,
          title: e.title,
          detail: e.detail,
          timestamp: e.timestamp,
        });
      }
    }
    recentEvents.sort((a, b) => b.timestamp - a.timestamp);

    return {
      activeCount: invDocs.filter((d) => d.status === "active").length,
      completedCount: invDocs.filter((d) => d.status === "completed").length,
      archivedCount: invDocs.filter((d) => d.status === "archived").length,
      evidenceCount,
      reportCount: reportDocs.length,
      recent,
      recentActivity: recentEvents.slice(0, 20),
    };
  },
});

export const listReports = query({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    const docs = await ctx.db
      .query("reports")
      .withIndex("by_owner_generated", (q) => q.eq("owner", owner))
      .order("desc")
      .take(100);
    return docs.map((d) => d.reportData as EvidenceReport);
  },
});

export const getReport = query({
  args: { reportId: v.string() },
  handler: async (ctx, { reportId }) => {
    const owner = await requireOwner(ctx);
    const doc = await ctx.db
      .query("reports")
      .withIndex("by_owner_report_id", (q) =>
        q.eq("owner", owner).eq("reportId", reportId),
      )
      .first();
    return doc ? (doc.reportData as EvidenceReport) : null;
  },
});

export const getEvidence = query({
  args: { evidenceId: v.id("evidence") },
  handler: async (ctx, { evidenceId }) => {
    const doc = await ctx.db.get(evidenceId);
    if (!doc) return null;
    const owner = await requireOwner(ctx);
    if (doc.owner !== owner) throw new Error("Not authorized");
    const source = doc.sourceMessageId
      ? await ctx.db.get(doc.sourceMessageId as Id<"messages">)
      : null;
    return {
      evidence: docToEvidence(doc),
      sourceMessage: source
        ? docToMessage(source, doc.caseId)
        : null,
    };
  },
});

/**
 * Compact case context for the AI actions: transcript + detected tactics +
 * kill-chain stages. Authorization included via requireInvestigation.
 */
export const investigationMeta = query({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) => {
    const inv = await requireInvestigation(ctx, caseId);
    const runtime = await buildRuntime(ctx.db, inv);
    return {
      title: inv.title,
      category: inv.category,
      currentStage: inv.currentStage,
      transcript: runtime.messages.map((m) => ({
        author: m.author,
        text: m.text,
      })),
      tactics: runtime.tactics.map((t) => t.tactic),
      stages: (inv.stages as KillChainStage[])
        .filter((s) => s.status !== "pending")
        .map((s) => s.label),
    };
  },
});

export const pendingStrategy = query({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) => {
    const inv = await requireInvestigation(ctx, caseId);
    const pending = await ctx.db
      .query("strategies")
      .withIndex("by_investigation_status", (q) =>
        q.eq("investigationId", inv._id).eq("status", "pending"),
      )
      .unique();
    return pending;
  },
});

export const getSettings = query({
  args: {},
  handler: async (ctx) => loadSettings(ctx.db, await requireOwner(ctx)),
});

// ---------------------------------------------------------------------------
// Investigation management
// ---------------------------------------------------------------------------

async function seedOpening(
  db: MutationCtx["db"],
  inv: Doc<"investigations">,
): Promise<void> {
  if (inv.source !== "simulation") return;
  const now = Date.now();
  const msgId = await db.insert("messages", {
    investigationId: inv._id,
    owner: inv.owner,
    caseId: inv.caseId,
    messageNumber: 1,
    sender: "scammer",
    content: OPENING_TURN.text,
    source: "SIM-ENGINE",
    timestamp: now,
  });
  const doc = (await db.get(msgId))!;
  await processMessage(db, inv, doc, {
    autoExtract: true,
    autoHash: true,
  });
  await db.patch(inv._id, { cursor: 1, turnCount: 1 });
  await refreshStrategy(db, (await db.get(inv._id))!);
}

export const createInvestigation = mutation({
  args: {
    caseId: v.optional(v.string()),
    title: v.string(),
    category: v.string(),
    description: v.string(),
    notes: v.optional(v.string()),
    source: v.union(
      v.literal("simulation"),
      v.literal("paste"),
      v.literal("import"),
    ),
    detectionMode: v.union(
      v.literal("simulation"),
      v.literal("balanced"),
      v.literal("manual"),
    ),
    flags: v.object({
      tacticDetection: v.boolean(),
      identifierExtraction: v.boolean(),
      integrityHashing: v.boolean(),
      aiSuggestions: v.boolean(),
    }),
    transcript: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const existing = await ctx.db
      .query("investigations")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .collect();
    let caseId = args.caseId ?? nextCaseId(existing);
    if (existing.some((i) => i.caseId === caseId)) {
      caseId = nextCaseId(existing);
    }

    const now = Date.now();
    const invId = await ctx.db.insert("investigations", {
      caseId,
      owner,
      title: args.title,
      category: args.category,
      description: args.description,
      notes: args.notes ?? "",
      status: "active",
      source: args.source,
      detectionMode: args.detectionMode,
      flags: args.flags,
      currentStage: "contact",
      createdAt: now,
      lastActivityAt: now,
      runStatus: "running",
      startedAt: now,
      cursor: 0,
      turnCount: 0,
      stages: createStages(),
      schemaVersion: SCHEMA_VERSION,
    });
    const inv = (await ctx.db.get(invId))!;

    await pushEvent(
      ctx.db,
      inv,
      "case_started",
      "Investigation started",
      `${args.category} · source ${args.source}`,
      now,
    );
    await pushLog(
      ctx.db,
      inv,
      "info",
      `Case ${caseId} initialised (${args.detectionMode} mode)`,
      now,
    );

    // Imported / pasted transcripts are indexed as messages + evidence.
    if (args.transcript?.trim()) {
      const lines = args.transcript.split(/\r?\n/).filter((l) => l.trim());
      let stamp = 0;
      let number = 0;
      for (const line of lines) {
        const m = line.match(
          /^(?:\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*)?([A-Za-z][A-Za-z ]{1,20}):\s*(.+)$/,
        );
        if (!m) continue;
        const who = m[1]!.toLowerCase().trim();
        const isDecoy = /^(me|you|decoy|self|operator|user|jaal)$/.test(who);
        number += 1;
        const msgId = await ctx.db.insert("messages", {
          investigationId: inv._id,
          owner,
          caseId,
          messageNumber: number,
          sender: isDecoy ? "decoy" : "scammer",
          content: m[2]!,
          source: args.source === "paste" ? "OPERATOR" : "TRANSCRIPT-IMPORT",
          timestamp: now + stamp * 1500,
          status: isDecoy ? "DECOY-ACTIVE" : undefined,
        });
        const doc = (await ctx.db.get(msgId))!;
        await processMessage(ctx.db, inv, doc, {
          autoExtract: true,
          autoHash: true,
        });
        stamp += 1;
      }
      await pushLog(
        ctx.db,
        inv,
        "info",
        `Transcript indexed · ${number} messages`,
      );
    } else if (args.source === "simulation") {
      await seedOpening(ctx.db, inv);
    }

    await refreshStrategy(ctx.db, (await ctx.db.get(invId))!);
    return caseId;
  },
});

export const setRunStatus = mutation({
  args: {
    caseId: v.string(),
    action: v.union(v.literal("pause"), v.literal("resume")),
  },
  handler: async (ctx, { caseId, action }) => {
    const inv = await requireInvestigation(ctx, caseId);
    if (inv.runStatus === "completed") return;
    const runStatus = action === "pause" ? "paused" : "running";
    await ctx.db.patch(inv._id, {
      runStatus,
      ...(action === "resume" ? { endedAt: undefined } : {}),
    });
    await pushLog(
      ctx.db,
      inv,
      "info",
      action === "pause"
        ? "Simulation paused by operator"
        : "Simulation resumed by operator",
    );
  },
});

async function completeInvestigationDoc(
  db: MutationCtx["db"],
  inv: Doc<"investigations">,
  generatedBy: string,
  { generateReport: makeReport = true }: { generateReport?: boolean } = {},
): Promise<void> {
  if (inv.runStatus === "completed") return;
  const now = Date.now();
  await db.patch(inv._id, {
    runStatus: "completed",
    status: "completed",
    endedAt: inv.endedAt ?? now,
    completedAt: now,
  });
  await pushLog(
    db,
    inv,
    "success",
    "Simulation script exhausted — investigation completed",
    now,
  );
  await pushEvent(
    db,
    inv,
    "stage_advanced",
    "Investigation completed",
    "Simulation ended — evidence preserved",
    now,
  );
  if (makeReport) {
    await generateReportDoc(db, (await db.get(inv._id))!, generatedBy, {});
  }
}

async function generateReportDoc(
  db: MutationCtx["db"],
  inv: Doc<"investigations">,
  generatedBy: string,
  opts: { reportId?: string; generatedAt?: number },
): Promise<EvidenceReport> {
  const runtime = await buildRuntime(db, inv);
  const investigation = docToInvestigation(inv);
  const now = opts.generatedAt ?? Date.now();
  const built = buildReport(investigation, runtime, generatedBy, now);
  const report: EvidenceReport = {
    ...built,
    id: opts.reportId ?? built.id,
  };

  const existing = await db
    .query("reports")
    .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
    .collect();
  const version = existing.length + 1;

  await db.insert("reports", {
    investigationId: inv._id,
    owner: inv.owner,
    caseId: inv.caseId,
    reportId: report.id,
    reportVersion: version,
    summary: report.summary as unknown,
    reportData: report,
    generatedAt: report.generatedAt,
    reportStatus: "GENERATED",
    simulated: true,
  });
  await pushLog(
    db,
    inv,
    "success",
    `Report ${report.id} created`,
    report.generatedAt,
  );
  await pushEvent(
    db,
    inv,
    "report_created",
    `Report ${report.id} created`,
    `${report.evidenceCount} evidence items included`,
    report.generatedAt,
  );
  await capTable(db, inv, "logs", MAX_LOG_DOCS);
  await capTable(db, inv, "events", MAX_EVENT_DOCS);
  return report;
}

export const completeInvestigation = mutation({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) => {
    const inv = await requireInvestigation(ctx, caseId);
    const identity = await ctx.auth.getUserIdentity();
    await completeInvestigationDoc(
      ctx.db,
      inv,
      identity?.name ?? identity?.subject ?? "Simulation operator",
    );
    return { ok: true };
  },
});

export const archiveInvestigation = mutation({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) => {
    const inv = await requireInvestigation(ctx, caseId);
    await ctx.db.patch(inv._id, { status: "archived" });
    await pushLog(ctx.db, inv, "info", "Case archived by operator");
  },
});

export const setInvestigationStatus = mutation({
  args: {
    caseId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("archived"),
    ),
  },
  handler: async (ctx, { caseId, status }) => {
    const inv = await requireInvestigation(ctx, caseId);
    await ctx.db.patch(inv._id, { status });
  },
});

// ---------------------------------------------------------------------------
// Conversation processing (central pipeline — no duplicated route logic)
// ---------------------------------------------------------------------------

async function ingestMessageDoc(
  ctx: MutationCtx,
  inv: Doc<"investigations">,
  args: {
    sender: "scammer" | "decoy" | "system";
    content: string;
    source: string;
    status?: string;
    timestamp?: number;
  },
): Promise<Doc<"messages">> {
  const count = await countMessages(ctx.db, inv);
  const id = await ctx.db.insert("messages", {
    investigationId: inv._id,
    owner: inv.owner,
    caseId: inv.caseId,
    messageNumber: count + 1,
    sender: args.sender,
    content: args.content,
    source: args.source,
    timestamp: args.timestamp ?? Date.now(),
    status: args.status,
  });
  const doc = (await ctx.db.get(id))!;
  const settings = await loadSettings(ctx.db, inv.owner);
  await processMessage(ctx.db, inv, doc, {
    autoExtract: settings.investigation.autoExtract,
    autoHash: settings.investigation.autoHash,
  });
  await capTable(ctx.db, inv, "logs", MAX_LOG_DOCS);
  await capTable(ctx.db, inv, "events", MAX_EVENT_DOCS);
  return doc;
}

/**
 * Send an operator (decoy) message, run the pipeline, then produce the
 * scripted scammer reply (contextual branch or next arc line). Mirrors the
 * local simulation engine's rules but executes entirely server-side.
 */
async function sendDecoyAndReply(
  ctx: MutationCtx,
  inv: Doc<"investigations">,
  text: string,
): Promise<{
  reply: string | null;
  completed: boolean;
  exhausted: boolean;
}> {
  if (inv.runStatus !== "running") {
    return { reply: null, completed: inv.runStatus === "completed", exhausted: true };
  }
  await enforceMessageRateLimit(ctx.db, inv);

  await ingestMessageDoc(ctx, inv, {
    sender: "decoy",
    content: text,
    source: "OPERATOR",
    status: "DECOY-ACTIVE",
  });
  await pushLog(ctx.db, inv, "info", "Operator (decoy) message sent");
  await pushEvent(
    ctx.db,
    inv,
    "message",
    "Decoy message sent",
    text.slice(0, 96),
  );

  const fresh = (await ctx.db.get(inv._id))!;
  const turn = nextScammerTurn(text, fresh.cursor, fresh.turnCount);

  if (turn.exhausted) {
    await ingestMessageDoc(ctx, fresh, {
      sender: "system",
      content:
        "Channel quiet — scripted simulation exhausted. Investigation marked complete.",
      source: "SIM-ENGINE",
    });
    const identity = await ctx.auth.getUserIdentity();
    await completeInvestigationDoc(
      ctx.db,
      (await ctx.db.get(fresh._id))!,
      identity?.name ?? identity?.subject ?? "Simulation operator",
    );
    return { reply: null, completed: true, exhausted: true };
  }

  const replyDoc = await ingestMessageDoc(ctx, fresh, {
    sender: "scammer",
    content: turn.text,
    source: turn.branch ? `SIM-ENGINE·${turn.branch.id}` : "SIM-ENGINE",
  });

  const nextCursor = fresh.cursor + (turn.arc ? 1 : 0);
  const turnCount = fresh.turnCount + 1;
  await ctx.db.patch(fresh._id, { cursor: nextCursor, turnCount });

  // Rule-based strategy refresh (labeled SIMULATION). The AI action wrapper
  // may supersede this with an LLM-generated strategy when configured.
  await refreshStrategy(ctx.db, (await ctx.db.get(fresh._id))!);

  if (arcExhausted(nextCursor) && !turn.branch) {
    const identity = await ctx.auth.getUserIdentity();
    await completeInvestigationDoc(
      ctx.db,
      (await ctx.db.get(fresh._id))!,
      identity?.name ?? identity?.subject ?? "Simulation operator",
    );
    return { reply: replyDoc.content, completed: true, exhausted: false };
  }

  return { reply: replyDoc.content, completed: false, exhausted: false };
}

/**
 * Apply an LLM-generated strategy over the pending rule-based suggestion.
 * Called by the AI action wrapper (actions may call mutations; mutations
 * cannot call actions). Passing no override records the fallback reason.
 */
export const applyStrategyOverride = internalMutation({
  args: {
    caseId: v.string(),
    override: v.optional(
      v.object({
        objective: v.string(),
        informationGap: v.string(),
        suggestedQuestion: v.string(),
        reason: v.string(),
      }),
    ),
    fallbackReason: v.optional(v.string()),
  },
  handler: async (ctx, { caseId, override, fallbackReason }) => {
    const inv = await requireInvestigation(ctx, caseId);
    if (!override) {
      await pushLog(
        ctx.db,
        inv,
        "warn",
        `AI provider unavailable — ${fallbackReason ?? "no suggestion"}. Strategy engine fell back to simulation rules.`,
      );
      return { applied: false };
    }
    const pending = await ctx.db
      .query("strategies")
      .withIndex("by_investigation_status", (q) =>
        q.eq("investigationId", inv._id).eq("status", "pending"),
      )
      .collect();
    for (const doc of pending) {
      await ctx.db.patch(doc._id, { status: "superseded" });
    }
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .collect();
    const lastScammer = [...messages]
      .sort((a, b) => a.timestamp - b.timestamp)
      .reverse()
      .find((m) => m.sender === "scammer");
    await ctx.db.insert("strategies", {
      investigationId: inv._id,
      owner: inv.owner,
      caseId,
      objective: override.objective,
      informationGap: override.informationGap,
      suggestedQuestion: override.suggestedQuestion,
      reason: override.reason,
      relatedMessageIds: lastScammer ? [lastScammer._id] : [],
      engineMode: "ANTHROPIC",
      status: "pending",
      createdAt: Date.now(),
    });
    await pushLog(
      ctx.db,
      inv,
      "info",
      `AI analysis: strategy generated (ANTHROPIC) → “${override.suggestedQuestion}”`,
    );
    return { applied: true };
  },
});

export const sendMessage = mutation({
  args: {
    caseId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { caseId, text }) => {
    const trimmed = text.trim();
    if (!trimmed) return { reply: null, completed: false, exhausted: true };
    const inv = await requireInvestigation(ctx, caseId);
    return sendDecoyAndReply(ctx, inv, trimmed);
  },
});

export const simulationNext = mutation({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) => {
    const inv = await requireInvestigation(ctx, caseId);
    if (inv.runStatus !== "running") {
      return { reply: null, completed: inv.runStatus === "completed", exhausted: true };
    }
    await enforceMessageRateLimit(ctx.db, inv);
    const fresh = (await ctx.db.get(inv._id))!;
    if (arcExhausted(fresh.cursor)) {
      await ingestMessageDoc(ctx, fresh, {
        sender: "system",
        content: "Script exhausted — no further synthetic lines available.",
        source: "SIM-ENGINE",
      });
      const identity = await ctx.auth.getUserIdentity();
      await completeInvestigationDoc(
        ctx.db,
        (await ctx.db.get(fresh._id))!,
        identity?.name ?? identity?.subject ?? "Simulation operator",
      );
      return { reply: null, completed: true, exhausted: true };
    }

    const turn = nextScammerTurn("", fresh.cursor, fresh.turnCount);
    if (turn.exhausted) {
      const identity = await ctx.auth.getUserIdentity();
      await completeInvestigationDoc(
        ctx.db,
        fresh,
        identity?.name ?? identity?.subject ?? "Simulation operator",
      );
      return { reply: null, completed: true, exhausted: true };
    }
    const replyDoc = await ingestMessageDoc(ctx, fresh, {
      sender: "scammer",
      content: turn.text,
      source: turn.branch ? `SIM-ENGINE·${turn.branch.id}` : "SIM-ENGINE",
    });
    const nextCursor = fresh.cursor + (turn.arc ? 1 : 0);
    await ctx.db.patch(fresh._id, {
      cursor: nextCursor,
      turnCount: fresh.turnCount + 1,
    });
    await refreshStrategy(ctx.db, (await ctx.db.get(fresh._id))!);

    if (arcExhausted(nextCursor) && !turn.branch) {
      const identity = await ctx.auth.getUserIdentity();
      await completeInvestigationDoc(
        ctx.db,
        (await ctx.db.get(fresh._id))!,
        identity?.name ?? identity?.subject ?? "Simulation operator",
      );
      return { reply: replyDoc.content, completed: true, exhausted: false };
    }
    return { reply: replyDoc.content, completed: false, exhausted: false };
  },
});

export const ingestMessages = mutation({
  args: {
    caseId: v.string(),
    messages: v.array(
      v.object({
        sender: v.union(v.literal("scammer"), v.literal("decoy")),
        content: v.string(),
        source: v.string(),
        timestamp: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { caseId, messages }) => {
    const inv = await requireInvestigation(ctx, caseId);
    let count = 0;
    for (const m of messages) {
      if (!m.content.trim()) continue;
      await ingestMessageDoc(ctx, inv, {
        sender: m.sender,
        content: m.content,
        source: m.source,
        status: m.sender === "decoy" ? "DECOY-ACTIVE" : undefined,
        timestamp: m.timestamp,
      });
      count += 1;
    }
    await pushLog(ctx.db, inv, "info", `Transcript import · ${count} messages`);
    return count;
  },
});

export const approveStrategy = mutation({
  args: {
    caseId: v.string(),
    editedText: v.optional(v.string()),
  },
  handler: async (ctx, { caseId, editedText }) => {
    const inv = await requireInvestigation(ctx, caseId);
    const pending = await ctx.db
      .query("strategies")
      .withIndex("by_investigation_status", (q) =>
        q.eq("investigationId", inv._id).eq("status", "pending"),
      )
      .unique();
    if (!pending) throw new Error("No pending strategy for this case");
    const text = (editedText ?? pending.suggestedQuestion).trim();
    if (!text) throw new Error("Approved strategy text is empty");
    await ctx.db.patch(pending._id, { status: "approved" });
    return sendDecoyAndReply(ctx, inv, text);
  },
});

export const dismissStrategy = mutation({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) => {
    const inv = await requireInvestigation(ctx, caseId);
    const pending = await ctx.db
      .query("strategies")
      .withIndex("by_investigation_status", (q) =>
        q.eq("investigationId", inv._id).eq("status", "pending"),
      )
      .collect();
    for (const doc of pending) {
      await ctx.db.patch(doc._id, { status: "dismissed" });
    }
  },
});

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

async function wipeCase(
  db: MutationCtx["db"],
  inv: Doc<"investigations">,
): Promise<void> {
  for (const table of ["messages", "tactics", "evidence", "events", "logs", "analyses", "strategies"] as const) {
    const docs = await db
      .query(table)
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .collect();
    for (const doc of docs) await db.delete(doc._id);
  }
}

export const resetCase = mutation({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) => {
    const inv = await requireInvestigation(ctx, caseId);
    await wipeCase(ctx.db, inv);
    const now = Date.now();
    await ctx.db.patch(inv._id, {
      status: "active",
      runStatus: "running",
      currentStage: "contact",
      createdAt: now,
      lastActivityAt: now,
      startedAt: now,
      endedAt: undefined,
      completedAt: undefined,
      cursor: 0,
      turnCount: 0,
      stages: createStages(),
    });
    await pushLog(
      ctx.db,
      inv,
      "success",
      "Simulation reset — session cleared",
      now,
    );
    await seedOpening(ctx.db, (await ctx.db.get(inv._id))!);
    return { ok: true };
  },
});

/**
 * Permanently delete one owned case and everything attached to it
 * (messages, tactics, evidence, events, logs, strategies, reports).
 * Owner-scoped — used to clean up operator test runs.
 */
export const deleteInvestigation = mutation({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) => {
    const inv = await requireInvestigation(ctx, caseId);
    await wipeCase(ctx.db, inv);
    const reportDocs = await ctx.db
      .query("reports")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .collect();
    for (const r of reportDocs) await ctx.db.delete(r._id);
    await ctx.db.delete(inv._id);
    return { deleted: caseId };
  },
});

export const clearLogs = mutation({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) => {
    const inv = await requireInvestigation(ctx, caseId);
    const docs = await ctx.db
      .query("logs")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .collect();
    for (const doc of docs) await ctx.db.delete(doc._id);
    await pushLog(ctx.db, inv, "info", "Log cleared by operator");
  },
});

// ---------------------------------------------------------------------------
// Evidence integrity (SHA-256 via Web Crypto)
// ---------------------------------------------------------------------------

export const generateHash = mutation({
  args: { evidenceId: v.id("evidence") },
  handler: async (ctx, { evidenceId }) => {
    const doc = await ctx.db.get(evidenceId);
    if (!doc) throw new Error("Evidence not found");
    const owner = await requireOwner(ctx);
    if (doc.owner !== owner) throw new Error("Not authorized");
    const hash = await sha256Hex(doc.content);
    const at = Date.now();
    await ctx.db.patch(evidenceId, {
      integrityHash: hash,
      integrityAlgorithm: "SHA-256",
      integrityStatus: "HASH_GENERATED",
      hashGeneratedAt: at,
      tampered: false,
    });
    const inv = await ctx.db.get(doc.investigationId);
    if (inv) {
      await pushEvent(
        ctx.db,
        inv,
        "hash_generated",
        "Evidence hash generated",
        `${doc.label}: ${doc.extractedValue}`,
        at,
      );
      await pushLog(ctx.db, inv, "success", `SHA-256 hash generated · ${doc.label}`, at);
    }
    return { hash, at };
  },
});

export const verifyEvidence = mutation({
  args: { evidenceId: v.id("evidence") },
  handler: async (ctx, { evidenceId }): Promise<"match" | "mismatch" | "generated" | "error"> => {
    const doc = await ctx.db.get(evidenceId);
    if (!doc) return "error";
    const owner = await requireOwner(ctx);
    if (doc.owner !== owner) throw new Error("Not authorized");
    const inv = await ctx.db.get(doc.investigationId);
    if (!doc.integrityHash) {
      // No recorded hash — generate one, report the generated state.
      const hash = await sha256Hex(doc.content);
      const at = Date.now();
      await ctx.db.patch(evidenceId, {
        integrityHash: hash,
        integrityAlgorithm: "SHA-256",
        integrityStatus: "HASH_GENERATED",
        hashGeneratedAt: at,
      });
      if (inv) {
        await pushEvent(
          ctx.db,
          inv,
          "hash_generated",
          "Evidence hash generated",
          `${doc.label}: ${doc.extractedValue}`,
          at,
        );
        await pushLog(ctx.db, inv, "success", `SHA-256 hash generated · ${doc.label}`, at);
      }
      return "generated";
    }
    const recomputed = await sha256Hex(doc.content);
    const match = recomputed.toLowerCase() === doc.integrityHash.toLowerCase();
    const at = Date.now();
    await ctx.db.patch(evidenceId, {
      integrityStatus: match ? "INTEGRITY_VERIFIED" : "HASH_MISMATCH",
    });
    if (inv) {
      if (match) {
        await pushEvent(
          ctx.db,
          inv,
          "integrity_verified",
          "Integrity verified",
          `${doc.label}: content matches recorded hash`,
          at,
        );
        await pushLog(ctx.db, inv, "success", `Integrity verified · ${doc.label}`, at);
      } else {
        await pushEvent(
          ctx.db,
          inv,
          "integrity_mismatch",
          "Integrity mismatch",
          `${doc.label}: content no longer matches the recorded hash`,
          at,
        );
        await pushLog(
          ctx.db,
          inv,
          "error",
          `Hash mismatch · ${doc.label} — content no longer matches the recorded hash`,
          at,
        );
      }
    }
    return match ? "match" : "mismatch";
  },
});

export const setEvidenceContent = mutation({
  args: { evidenceId: v.id("evidence"), content: v.string() },
  handler: async (ctx, { evidenceId, content }) => {
    const doc = await ctx.db.get(evidenceId);
    if (!doc) return;
    const owner = await requireOwner(ctx);
    if (doc.owner !== owner) throw new Error("Not authorized");
    await ctx.db.patch(evidenceId, { content, tampered: true });
    const inv = await ctx.db.get(doc.investigationId);
    if (inv) {
      await pushLog(
        ctx.db,
        inv,
        "warn",
        "Evidence content modified by operator (integrity demo)",
      );
    }
  },
});

export const setEvidenceNotes = mutation({
  args: { evidenceId: v.id("evidence"), notes: v.string() },
  handler: async (ctx, { evidenceId, notes }) => {
    const doc = await ctx.db.get(evidenceId);
    if (!doc) return;
    const owner = await requireOwner(ctx);
    if (doc.owner !== owner) throw new Error("Not authorized");
    await ctx.db.patch(evidenceId, { notes });
  },
});

/**
 * Analyst review of an extracted item (Confirmed / Incorrect / Needs review).
 * The verdict is stored separately — extraction fields (value, content, hash)
 * are never altered by a review.
 */
export const reviewEvidence = mutation({
  args: {
    evidenceId: v.id("evidence"),
    status: v.union(
      v.literal("confirmed"),
      v.literal("incorrect"),
      v.literal("needs_review"),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { evidenceId, status, note }) => {
    const doc = await ctx.db.get(evidenceId);
    if (!doc) return;
    const owner = await requireOwner(ctx);
    if (doc.owner !== owner) throw new Error("Not authorized");
    const at = Date.now();
    await ctx.db.patch(evidenceId, {
      reviewStatus: status,
      reviewNote: note ?? doc.reviewNote,
      reviewedAt: at,
    });
    const inv = await ctx.db.get(doc.investigationId);
    if (inv) {
      const label =
        status === "confirmed"
          ? "confirmed by analyst"
          : status === "incorrect"
            ? "marked incorrect by analyst"
            : "flagged for review";
      await pushLog(ctx.db, inv, "info", `Analyst review · ${doc.label} ${label}`, at);
      await pushEvent(
        ctx.db,
        inv,
        "evidence_reviewed",
        "Analyst review recorded",
        `${doc.label}: ${doc.extractedValue} — ${label}`,
        at,
      );
    }
  },
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const generateReport = mutation({
  args: {
    caseId: v.string(),
    reportId: v.optional(v.string()),
    generatedAt: v.optional(v.number()),
  },
  handler: async (ctx, { caseId, reportId, generatedAt }) => {
    const inv = await requireInvestigation(ctx, caseId);
    const identity = await ctx.auth.getUserIdentity();
    const report = await generateReportDoc(
      ctx.db,
      inv,
      identity?.name ?? identity?.subject ?? "Simulation operator",
      { reportId, generatedAt },
    );
    return report;
  },
});

/** Replace a report's summary with an LLM-written one (labeled engine). */
export const applyReportSummary = internalMutation({
  args: {
    caseId: v.string(),
    reportId: v.string(),
    summary: v.string(),
    engineMode: v.string(),
  },
  handler: async (ctx, { caseId, reportId, summary, engineMode }) => {
    const inv = await requireInvestigation(ctx, caseId);
    const docs = await ctx.db
      .query("reports")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .collect();
    const doc = docs.find((d) => d.reportId === reportId);
    if (!doc) return;
    const data = doc.reportData as EvidenceReport;
    await ctx.db.patch(doc._id, {
      summary,
      reportData: {
        ...data,
        summary: {
          ...data.summary,
          // The executive narrative slot carries the model-written summary;
          // the engine label keeps provenance explicit.
          scenario: summary,
          engineLabel: `LLM summary (${engineMode})`,
        },
      },
    });
    await pushLog(
      ctx.db,
      inv,
      "info",
      `Report ${reportId} summary generated via ${engineMode}`,
    );
  },
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const updateSettings = mutation({
  args: {
    appearance: v.optional(v.any()),
    investigation: v.optional(v.any()),
    simulation: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.appearance ? { appearance: args.appearance } : {}),
        ...(args.investigation ? { investigation: args.investigation } : {}),
        ...(args.simulation ? { simulation: args.simulation } : {}),
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("settings", {
        owner,
        appearance: args.appearance ?? {},
        investigation: args.investigation ?? {},
        simulation: args.simulation ?? {},
        updatedAt: now,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Demo seed + reset
// ---------------------------------------------------------------------------

async function seedForOwner(
  ctx: MutationCtx,
  owner: string,
): Promise<number> {
  const seeds = buildSeedCases();
  let created = 0;
  for (const seed of seeds) {
    const existing = await ctx.db
      .query("investigations")
      .withIndex("by_owner_case", (q) =>
        q.eq("owner", owner).eq("caseId", seed.investigation.id),
      )
      .unique();
    if (existing) continue;

    const invId = await ctx.db.insert("investigations", {
      caseId: seed.investigation.id,
      owner,
      title: seed.investigation.title,
      category: seed.investigation.category,
      description: seed.investigation.description,
      notes: seed.investigation.notes,
      status: seed.investigation.status,
      source: seed.investigation.source,
      detectionMode: seed.investigation.detectionMode,
      flags: seed.investigation.flags,
      currentStage: seed.investigation.currentStage,
      createdAt: seed.investigation.createdAt,
      lastActivityAt: seed.investigation.lastActivityAt,
      completedAt: seed.endedAt ?? undefined,
      runStatus: seed.status,
      startedAt: seed.startedAt,
      endedAt: seed.endedAt ?? undefined,
      cursor: seed.cursor,
      turnCount: seed.turnCount,
      stages: createStages(),
      schemaVersion: SCHEMA_VERSION,
    });
    const inv = (await ctx.db.get(invId))!;
    created += 1;

    await pushEvent(
      ctx.db,
      inv,
      "case_started",
      "Investigation started",
      `${seed.investigation.category} · source ${seed.investigation.source}`,
      seed.startedAt,
    );

    let number = 0;
    for (const m of seed.messages) {
      number += 1;
      const msgId = await ctx.db.insert("messages", {
        investigationId: inv._id,
        owner,
        caseId: inv.caseId,
        messageNumber: number,
        sender: m.author,
        content: m.text,
        source: m.source,
        timestamp: m.timestamp,
        status: m.status,
      });
      const doc = (await ctx.db.get(msgId))!;
      await processMessage(ctx.db, inv, doc, {
        autoExtract: true,
        autoHash: true,
      });
    }

    if (seed.status === "completed") {
      await pushLog(
        ctx.db,
        inv,
        "success",
        "Simulation script exhausted — investigation completed",
        seed.endedAt ?? Date.now(),
      );
    }

    await refreshStrategy(ctx.db, (await ctx.db.get(inv._id))!);

    // Completed demo cases get a report so Reports has real data.
    if (seed.status === "completed") {
      await generateReportDoc(ctx.db, (await ctx.db.get(inv._id))!, "JAAL seed", {});
    }
  }
  return created;
}

export const seedDemo = mutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, { force }) => {
    const owner = await requireOwner(ctx);
    if (force) {
      const existing = await ctx.db
        .query("investigations")
        .withIndex("by_owner", (q) => q.eq("owner", owner))
        .collect();
      for (const inv of existing) {
        await wipeCase(ctx.db, inv);
        const reportDocs = await ctx.db
          .query("reports")
          .withIndex("by_investigation", (q) =>
            q.eq("investigationId", inv._id),
          )
          .collect();
        for (const r of reportDocs) await ctx.db.delete(r._id);
        await ctx.db.delete(inv._id);
      }
    }
    const created = await seedForOwner(ctx, owner);
    return { seeded: created };
  },
});

export const resetDemo = mutation({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    const existing = await ctx.db
      .query("investigations")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .collect();
    for (const inv of existing) {
      await wipeCase(ctx.db, inv);
      const reportDocs = await ctx.db
        .query("reports")
        .withIndex("by_investigation", (q) =>
          q.eq("investigationId", inv._id),
        )
        .collect();
      for (const r of reportDocs) await ctx.db.delete(r._id);
      await ctx.db.delete(inv._id);
    }
    const created = await seedForOwner(ctx, owner);
    return { seeded: created };
  },
});

/** Convenience id helper re-exported for debugging. */
export { rid };
