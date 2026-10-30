/**
 * JAAL INTELLIGENCE ENGINE — queries and mutations.
 *
 * This file owns the AI analysis lifecycle, copilot history and correlation
 * review workflow. It never calls a provider: the "use node" actions in
 * `intelligenceActions.ts` do that, then store validated results through the
 * internal mutations here.
 *
 * Security: every public function resolves the case through the owner index
 * (`by_owner_case`) after `getOwner`, so cross-user access fails exactly like
 * the rest of the JAAL backend. AI rows are stored separately from messages
 * and evidence — nothing in this file can mutate original case content.
 */
import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  AI_MAX_MESSAGE_CHARS,
  AI_MAX_TRANSCRIPT_MESSAGES,
  assertLength,
  getOwner,
  pushEvent,
  pushLog,
} from "./lib/backend";
import {
  AI_MODULES,
  MODULE_SCHEMA_VERSION,
  buildAliasIndex,
  caseFingerprint,
  isStale,
  type CaseAliasIndex,
} from "./lib/intelligence";

/** Controlled vocabulary for the four analysis modules. */
const moduleValidator = v.union(
  v.literal("threat"),
  v.literal("prediction"),
  v.literal("correlation"),
  v.literal("report"),
);

// ---------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------

async function requireCase(
  ctx: QueryCtx | MutationCtx,
  caseId: string,
): Promise<Doc<"investigations">> {
  const owner = await getOwner(ctx);
  const inv = await ctx.db
    .query("investigations")
    .withIndex("by_owner_case", (q) => q.eq("owner", owner).eq("caseId", caseId))
    .unique();
  if (!inv) throw new Error(`Investigation ${caseId} not found`);
  return inv;
}

/** Fingerprint of everything an analysis depends on (messages/evidence/tactics). */
async function fingerprintCase(
  db: QueryCtx["db"],
  inv: Doc<"investigations">,
): Promise<{
  fingerprint: string;
  messageCount: number;
  lastMessageAt: number;
  evidenceCount: number;
  lastEvidenceAt: number;
  tacticCount: number;
}> {
  const [messages, evidence, tactics] = await Promise.all([
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
  ]);
  const lastMessageAt = messages.reduce((max, m) => Math.max(max, m.timestamp), 0);
  const lastEvidenceAt = evidence.reduce((max, e) => Math.max(max, e.createdAt), 0);
  const fingerprint = caseFingerprint({
    messageCount: messages.length,
    lastMessageAt,
    evidenceCount: evidence.length,
    lastEvidenceAt,
    tacticCount: tactics.length,
  });
  return {
    fingerprint,
    messageCount: messages.length,
    lastMessageAt,
    evidenceCount: evidence.length,
    lastEvidenceAt,
    tacticCount: tactics.length,
  };
}

/**
 * Bounded, owner-scoped case context + alias index.
 *
 * The alias index is built from exactly the records the model will see, so
 * any alias the model invents cannot resolve and is dropped during grounding.
 */
async function loadCaseContext(
  db: QueryCtx["db"],
  inv: Doc<"investigations">,
): Promise<{ index: CaseAliasIndex; counts: Awaited<ReturnType<typeof fingerprintCase>> }> {
  const counts = await fingerprintCase(db, inv);

  const messageDocs = (
    await db
      .query("messages")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .collect()
  )
    .filter((m) => m.sender !== "system")
    .sort((a, b) => a.messageNumber - b.messageNumber)
    .slice(-AI_MAX_TRANSCRIPT_MESSAGES);

  const evidenceDocs = (
    await db
      .query("evidence")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .collect()
  )
    .filter((e) => e.owner === inv.owner)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-40);

  const tacticDocs = (
    await db
      .query("tactics")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .collect()
  )
    .filter((t) => t.owner === inv.owner)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-30);

  const index = buildAliasIndex({
    messages: messageDocs.map((m) => ({
      id: m._id,
      n: m.messageNumber,
      sender: m.sender,
      text: m.content.slice(0, AI_MAX_MESSAGE_CHARS),
      timestamp: m.timestamp,
    })),
    evidence: evidenceDocs.map((e) => ({
      id: e._id,
      label: e.label,
      type: e.evidenceType,
      value: e.extractedValue,
      integrityStatus: e.integrityStatus,
      reviewStatus: e.reviewStatus ?? null,
      sourceMessageId: e.sourceMessageId ?? null,
    })),
    tactics: tacticDocs.map((t) => ({
      id: t._id,
      tactic: t.tactic,
      messageId: t.messageId ?? null,
    })),
  });

  return { index, counts };
}

function analysisView(doc: Doc<"ai_analyses">, currentFingerprint: string) {
  return {
    module: doc.module,
    status: doc.status,
    at: doc.at,
    schemaVersion: doc.schemaVersion,
    fingerprint: doc.fingerprint,
    stale: isStale(doc.fingerprint, currentFingerprint),
    inputMessageCount: doc.inputMessageCount,
    provider: doc.provider ?? null,
    model: doc.model ?? null,
    limitations: doc.limitations,
    error: doc.error ?? null,
    durationMs: doc.durationMs ?? null,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Lightweight per-module status for the AI Intelligence hub. */
export const analyses = query({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) => {
    const inv = await requireCase(ctx, caseId);
    const counts = await fingerprintCase(ctx.db, inv);
    const rows = await ctx.db
      .query("ai_analyses")
      .withIndex("by_case_module", (q) => q.eq("investigationId", inv._id))
      .collect();
    return {
      fingerprint: counts.fingerprint,
      messageCount: counts.messageCount,
      evidenceCount: counts.evidenceCount,
      tacticCount: counts.tacticCount,
      analyses: AI_MODULES.map((m) => {
        const row = rows.find((r) => r.module === m);
        return row
          ? analysisView(row, counts.fingerprint)
          : {
              module: m,
              status: "NOT_STARTED" as const,
              at: 0,
              schemaVersion: MODULE_SCHEMA_VERSION[m],
              fingerprint: "",
              stale: false,
              inputMessageCount: 0,
              provider: null,
              model: null,
              limitations: [] as string[],
              error: null,
              durationMs: null,
            };
      }),
      pendingSuggestions: (
        await ctx.db
          .query("correlation_suggestions")
          .withIndex("by_investigation_status", (q) =>
            q.eq("investigationId", inv._id).eq("status", "PENDING_REVIEW"),
          )
          .collect()
      ).length,
    };
  },
});

/** Full stored result for one module (grounded output included). */
export const getAnalysis = query({
  args: { caseId: v.string(), module: moduleValidator },
  handler: async (ctx, { caseId, module }) => {
    const inv = await requireCase(ctx, caseId);
    const counts = await fingerprintCase(ctx.db, inv);
    const row = await ctx.db
      .query("ai_analyses")
      .withIndex("by_case_module", (q) =>
        q.eq("investigationId", inv._id).eq("module", module),
      )
      .unique();
    if (!row) return null;
    return { ...analysisView(row, counts.fingerprint), output: row.output ?? null };
  },
});

/** Alias-stamped case context for the copilot sidebar + debugging. */
export const caseContext = query({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) => {
    const inv = await requireCase(ctx, caseId);
    const { index, counts } = await loadCaseContext(ctx.db, inv);
    return {
      caseId,
      title: inv.title,
      category: inv.category,
      status: inv.status,
      currentStage: inv.currentStage,
      fingerprint: counts.fingerprint,
      messageCount: counts.messageCount,
      evidenceCount: counts.evidenceCount,
      tacticCount: counts.tacticCount,
      messages: index.messages.map((m) => ({
        alias: m.alias,
        id: m.id,
        n: m.n,
        sender: m.sender,
        text: m.text,
        timestamp: m.timestamp,
      })),
      evidence: index.evidence.map((e) => ({
        alias: e.alias,
        id: e.id,
        k: e.k,
        label: e.label,
        type: e.type,
        value: e.value,
        integrityStatus: e.integrityStatus,
        reviewStatus: e.reviewStatus,
        sourceMessageId: e.sourceMessageId,
      })),
      tactics: index.tactics.map((t) => ({
        alias: t.alias,
        id: t.id,
        t: t.t,
        tactic: t.tactic,
        messageId: t.messageId,
      })),
    };
  },
});

/** Copilot chat history for one case (owner-scoped, bounded). */
export const copilotHistory = query({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) => {
    const inv = await requireCase(ctx, caseId);
    const rows = await ctx.db
      .query("copilot_messages")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .order("asc")
      .collect();
    return rows.slice(-60).map((r) => ({
      id: r._id,
      role: r.role,
      content: r.content,
      sections: r.sections ?? null,
      refs: r.refs ?? null,
      status: r.status ?? null,
      error: r.error ?? null,
      at: r.at,
    }));
  },
});

/** Correlation suggestions (pending + reviewed) and confirmed count. */
export const suggestions = query({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) => {
    const inv = await requireCase(ctx, caseId);
    const [rows, confirmed] = await Promise.all([
      ctx.db
        .query("correlation_suggestions")
        .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
        .collect(),
      ctx.db
        .query("correlations")
        .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
        .collect(),
    ]);
    const sorted = rows.sort((a, b) => b.at - a.at);
    return {
      suggestions: sorted.map((r) => ({
        id: r._id,
        source: r.source,
        target: r.target,
        relation: r.relation,
        category: r.category,
        explanation: r.explanation,
        messageRefs: r.messageRefs,
        evidenceRefs: r.evidenceRefs,
        confidence: r.confidence,
        origin: r.origin,
        status: r.status,
        reviewer: r.reviewer ?? null,
        reviewedAt: r.reviewedAt ?? null,
        reviewNote: r.reviewNote ?? null,
        at: r.at,
      })),
      confirmedCount: confirmed.length,
    };
  },
});

// ---------------------------------------------------------------------------
// Analysis lifecycle (called by the node actions)
// ---------------------------------------------------------------------------

/**
 * Claim the (case, module) slot for a new run. Ownership-checked.
 *
 * - Reuses the stored result when its fingerprint matches and `force` is not
 *   set (no duplicate spend on unchanged conversations).
 * - Rejects concurrent runs unless the previous PROCESSING row is stale.
 * - Otherwise writes a PROCESSING row that clients subscribe to.
 */
export const beginAnalysis = mutation({
  args: {
    caseId: v.string(),
    module: moduleValidator,
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { caseId, module, force }) => {
    const inv = await requireCase(ctx, caseId);
    const counts = await fingerprintCase(ctx.db, inv);
    const now = Date.now();
    const existing = await ctx.db
      .query("ai_analyses")
      .withIndex("by_case_module", (q) =>
        q.eq("investigationId", inv._id).eq("module", module),
      )
      .unique();

    if (
      existing &&
      existing.status === "COMPLETED" &&
      !force &&
      !isStale(existing.fingerprint, counts.fingerprint)
    ) {
      return {
        reused: true,
        fingerprint: counts.fingerprint,
        analysis: analysisView(existing, counts.fingerprint),
      };
    }
    if (
      existing &&
      existing.status === "PROCESSING" &&
      now - existing.at < 90_000 &&
      !force
    ) {
      throw new Error("ANALYSIS_IN_PROGRESS — this module is already running.");
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "PROCESSING",
        at: now,
        error: undefined,
        output: undefined,
        limitations: [],
        fingerprint: counts.fingerprint,
        inputMessageCount: counts.messageCount,
        schemaVersion: MODULE_SCHEMA_VERSION[module],
      });
    } else {
      await ctx.db.insert("ai_analyses", {
        investigationId: inv._id,
        owner: inv.owner,
        caseId,
        module,
        status: "PROCESSING",
        schemaVersion: MODULE_SCHEMA_VERSION[module],
        fingerprint: counts.fingerprint,
        inputMessageCount: counts.messageCount,
        limitations: [],
        at: now,
      });
    }
    return { reused: false, fingerprint: counts.fingerprint, analysis: null };
  },
});

/** Store the terminal result of a run. Internal — server code only. */
export const saveAnalysis = internalMutation({
  args: {
    caseId: v.string(),
    module: moduleValidator,
    status: v.union(
      v.literal("PROCESSING"),
      v.literal("COMPLETED"),
      v.literal("FAILED"),
      v.literal("UNAVAILABLE"),
    ),
    fingerprint: v.string(),
    inputMessageCount: v.number(),
    schemaVersion: v.number(),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    output: v.optional(v.any()),
    limitations: v.array(v.string()),
    error: v.optional(v.string()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owner = await getOwner(ctx);
    const inv = await ctx.db
      .query("investigations")
      .withIndex("by_owner_case", (q) =>
        q.eq("owner", owner).eq("caseId", args.caseId),
      )
      .unique();
    if (!inv) throw new Error(`Investigation ${args.caseId} not found`);
    assertLength(JSON.stringify(args.output ?? null), 400_000, "AI analysis output");

    const now = Date.now();
    const existing = await ctx.db
      .query("ai_analyses")
      .withIndex("by_case_module", (q) =>
        q.eq("investigationId", inv._id).eq("module", args.module),
      )
      .unique();
    const row = {
      status: args.status,
      fingerprint: args.fingerprint,
      inputMessageCount: args.inputMessageCount,
      schemaVersion: args.schemaVersion,
      provider: args.provider,
      model: args.model,
      output: args.output,
      limitations: args.limitations,
      error: args.error,
      durationMs: args.durationMs,
      at: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, row);
      return existing._id;
    }
    return await ctx.db.insert("ai_analyses", {
      investigationId: inv._id,
      owner,
      caseId: args.caseId,
      module: args.module,
      ...row,
    });
  },
});

// ---------------------------------------------------------------------------
// Copilot
// ---------------------------------------------------------------------------

/** Append a validated copilot turn (question or grounded answer). */
export const appendCopilotTurn = internalMutation({
  args: {
    caseId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    sections: v.optional(v.any()),
    refs: v.optional(v.any()),
    status: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await getOwner(ctx);
    const inv = await ctx.db
      .query("investigations")
      .withIndex("by_owner_case", (q) =>
        q.eq("owner", owner).eq("caseId", args.caseId),
      )
      .unique();
    if (!inv) throw new Error(`Investigation ${args.caseId} not found`);
    const content = assertLength(args.content, 8_000, "Copilot message");
    await ctx.db.insert("copilot_messages", {
      investigationId: inv._id,
      owner,
      caseId: args.caseId,
      role: args.role,
      content,
      sections: args.sections,
      refs: args.refs,
      status: args.status,
      error: args.error,
      at: Date.now(),
    });
    // Bound the transcript of the chat itself.
    const all = await ctx.db
      .query("copilot_messages")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .order("asc")
      .take(200);
    for (const old of all.slice(0, Math.max(0, all.length - 120))) {
      await ctx.db.delete(old._id);
    }
  },
});

/**
 * Operational log line for an AI run — module, status, duration and error
 * CATEGORY only. Never conversation content or provider payloads.
 */
export const logAnalysis = internalMutation({
  args: {
    caseId: v.string(),
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    message: v.string(),
  },
  handler: async (ctx, { caseId, level, message }) => {
    const owner = await getOwner(ctx);
    const inv = await ctx.db
      .query("investigations")
      .withIndex("by_owner_case", (q) => q.eq("owner", owner).eq("caseId", caseId))
      .unique();
    if (!inv) return;
    await pushLog(ctx.db, inv, level, assertLength(message, 300, "AI log line"));
  },
});

/** Clear this case's copilot conversation (owner-initiated). */
export const clearCopilot = mutation({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) => {
    const inv = await requireCase(ctx, caseId);
    const rows = await ctx.db
      .query("copilot_messages")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return { cleared: rows.length };
  },
});

// ---------------------------------------------------------------------------
// Correlation suggestions + investigator review
// ---------------------------------------------------------------------------

/** Store AI-generated suggestions (deduplicated, always PENDING_REVIEW). */
export const saveCorrelationSuggestions = internalMutation({
  args: {
    caseId: v.string(),
    fingerprint: v.string(),
    suggestions: v.array(
      v.object({
        source: v.any(),
        target: v.any(),
        relation: v.string(),
        category: v.string(),
        explanation: v.string(),
        messageRefs: v.array(v.string()),
        evidenceRefs: v.array(v.string()),
        confidence: v.union(
          v.literal("low"),
          v.literal("medium"),
          v.literal("high"),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const owner = await getOwner(ctx);
    const inv = await ctx.db
      .query("investigations")
      .withIndex("by_owner_case", (q) =>
        q.eq("owner", owner).eq("caseId", args.caseId),
      )
      .unique();
    if (!inv) throw new Error(`Investigation ${args.caseId} not found`);

    const existing = await ctx.db
      .query("correlation_suggestions")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .collect();
    const key = (s: { source: { id: string }; target: { id: string }; relation: string }) =>
      `${s.source.id}->${s.target.id}:${s.relation}`;
    const seen = new Set(existing.map((e) => key(e)));

    let inserted = 0;
    for (const s of args.suggestions) {
      const k = key(s);
      if (seen.has(k)) continue;
      seen.add(k);
      assertLength(s.explanation, 800, "Correlation explanation");
      await ctx.db.insert("correlation_suggestions", {
        investigationId: inv._id,
        owner,
        caseId: args.caseId,
        source: s.source,
        target: s.target,
        relation: s.relation,
        category: assertLength(s.category, 120, "Correlation category"),
        explanation: s.explanation,
        messageRefs: s.messageRefs,
        evidenceRefs: s.evidenceRefs,
        confidence: s.confidence,
        origin: "AI",
        status: "PENDING_REVIEW",
        fingerprint: args.fingerprint,
        at: Date.now(),
      });
      inserted += 1;
    }
    return { inserted };
  },
});

/**
 * Deterministic correlation candidates — exact identifier matching and
 * message/tactic co-occurrence computed by the backend, never by the model.
 * Stored as PENDING_REVIEW like AI suggestions (approval is mandatory).
 */
export const deriveCorrelations = mutation({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) => {
    const inv = await requireCase(ctx, caseId);
    const { index, counts } = await loadCaseContext(ctx.db, inv);
    const now = Date.now();

    const existing = await ctx.db
      .query("correlation_suggestions")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .collect();
    const seen = new Set(
      existing.map(
        (e) => `${(e.source as { id: string }).id}->${(e.target as { id: string }).id}:${e.relation}`,
      ),
    );

    const candidates: {
      source: { kind: string; id: string; label: string };
      target: { kind: string; id: string; label: string };
      relation: string;
      category: string;
      explanation: string;
      messageRefs: string[];
      evidenceRefs: string[];
      confidence: "low" | "medium" | "high";
    }[] = [];

    // Rule 1 — REPEATED_IDENTIFIER: same normalized value extracted from two
    // different messages (exact deterministic comparison, no AI involved).
    const byValue = new Map<string, typeof index.evidence>();
    for (const e of index.evidence) {
      const k = e.value.trim().toLowerCase();
      const list = byValue.get(k) ?? [];
      list.push(e);
      byValue.set(k, list);
    }
    for (const group of byValue.values()) {
      const withSource = group.filter((e) => e.sourceMessageId);
      if (withSource.length < 2) continue;
      for (let i = 0; i < withSource.length; i++) {
        for (let j = i + 1; j < withSource.length; j++) {
          const a = withSource[i]!;
          const b = withSource[j]!;
          if (a.sourceMessageId === b.sourceMessageId) continue;
          candidates.push({
            source: { kind: "indicator", id: a.id, label: `${a.label}: ${a.value}` },
            target: { kind: "indicator", id: b.id, label: `${b.label}: ${b.value}` },
            relation: "REPEATED_IDENTIFIER",
            category: "Repeated identifier",
            explanation: `Exact match: "${a.value}" was extracted independently from two different messages (MSG #${index.messages.find((m) => m.id === a.sourceMessageId)?.n ?? "?"} and MSG #${index.messages.find((m) => m.id === b.sourceMessageId)?.n ?? "?"}).`,
            messageRefs: [a.sourceMessageId!, b.sourceMessageId!],
            evidenceRefs: [a.id, b.id],
            confidence: "high",
          });
        }
      }
    }

    // Rule 2 — PAYMENT_TACTIC: a payment indicator extracted from the same
    // message where a tactic was detected.
    for (const e of index.evidence) {
      if (e.type !== "payment_request") continue;
      if (!e.sourceMessageId) continue;
      for (const t of index.tactics) {
        if (t.messageId !== e.sourceMessageId) continue;
        candidates.push({
          source: { kind: "indicator", id: e.id, label: `${e.label}: ${e.value}` },
          target: { kind: "tactic", id: t.id, label: t.tactic },
          relation: "PAYMENT_TACTIC",
          category: "Financial link",
          explanation: `The payment request "${e.value}" was extracted from the same message where the tactic "${t.tactic}" was detected — the demand and the manipulation appear together.`,
          messageRefs: e.sourceMessageId ? [e.sourceMessageId] : [],
          evidenceRefs: [e.id],
          confidence: "high",
        });
      }
    }

    let inserted = 0;
    for (const c of candidates) {
      const k = `${c.source.id}->${c.target.id}:${c.relation}`;
      if (seen.has(k)) continue;
      seen.add(k);
      await ctx.db.insert("correlation_suggestions", {
        investigationId: inv._id,
        owner: inv.owner,
        caseId,
        source: c.source,
        target: c.target,
        relation: c.relation,
        category: c.category,
        explanation: c.explanation,
        messageRefs: c.messageRefs,
        evidenceRefs: c.evidenceRefs,
        confidence: c.confidence,
        origin: "RULE_BASED",
        status: "PENDING_REVIEW",
        fingerprint: counts.fingerprint,
        at: now,
      });
      inserted += 1;
    }
    if (inserted > 0) {
      await pushLog(
        ctx.db,
        inv,
        "info",
        `Correlation scan · ${inserted} deterministic candidate relationship(s) awaiting review`,
        now,
      );
    }
    return { candidates: candidates.length, inserted };
  },
});

async function resolveEntity(
  db: QueryCtx["db"],
  inv: Doc<"investigations">,
  entity: { kind: string; id: string },
): Promise<boolean> {
  if (entity.kind === "indicator") {
    const doc = await db.get(entity.id as Id<"evidence">);
    return !!doc && doc.investigationId === inv._id && doc.owner === inv.owner;
  }
  if (entity.kind === "message") {
    const doc = await db.get(entity.id as Id<"messages">);
    return !!doc && doc.investigationId === inv._id && doc.owner === inv.owner;
  }
  if (entity.kind === "tactic") {
    const doc = await db.get(entity.id as Id<"tactics">);
    return !!doc && doc.investigationId === inv._id && doc.owner === inv.owner;
  }
  return false;
}

/**
 * Investigator review — the ONLY path from a suggestion to a confirmed
 * relationship. Acceptance re-validates both endpoints against the caller's
 * own investigation scope before creating the confirmed record.
 */
export const reviewSuggestion = mutation({
  args: {
    suggestionId: v.id("correlation_suggestions"),
    decision: v.union(v.literal("accept"), v.literal("reject")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { suggestionId, decision, note }) => {
    const owner = await getOwner(ctx);
    const s = await ctx.db.get(suggestionId);
    if (!s || s.owner !== owner) throw new Error("Suggestion not found");
    if (s.status !== "PENDING_REVIEW") {
      throw new Error(`Suggestion already ${s.status} — review it only once.`);
    }
    const inv = await ctx.db.get(s.investigationId);
    if (!inv || inv.owner !== owner) throw new Error("Suggestion not found");
    const now = Date.now();
    const why = note ? assertLength(note, 500, "Review note") : undefined;

    if (decision === "reject") {
      await ctx.db.patch(suggestionId, {
        status: "REJECTED",
        reviewer: owner,
        reviewedAt: now,
        reviewNote: why,
      });
      await pushEvent(
        ctx.db,
        inv,
        "correlation",
        "Relationship suggestion rejected",
        `${s.source.label} → ${s.target.label}${why ? ` — ${why}` : ""}`,
        now,
      );
      return { status: "REJECTED" as const };
    }

    // Acceptance — re-validate BOTH endpoints inside this investigation.
    const srcOk = await resolveEntity(ctx.db, inv, s.source);
    const dstOk = await resolveEntity(ctx.db, inv, s.target);
    if (!srcOk || !dstOk) {
      throw new Error(
        "Suggestion references an entity outside this investigation — rejected.",
      );
    }

    const existingCorrelations = await ctx.db
      .query("correlations")
      .withIndex("by_investigation", (q) => q.eq("investigationId", inv._id))
      .collect();
    const duplicate = existingCorrelations.find(
      (c) =>
        (c.source as { id: string }).id === (s.source as { id: string }).id &&
        (c.target as { id: string }).id === (s.target as { id: string }).id &&
        c.relation === s.relation,
    );
    if (!duplicate) {
      await ctx.db.insert("correlations", {
        investigationId: inv._id,
        owner,
        caseId: s.caseId,
        source: s.source,
        target: s.target,
        relation: s.relation,
        basis: `${s.origin} suggestion (${s.confidence} confidence): ${s.explanation}${why ? ` Reviewer note: ${why}` : ""}`,
        messageRefs: s.messageRefs,
        evidenceRefs: s.evidenceRefs,
        suggestionId,
        acceptedBy: owner,
        acceptedAt: now,
      });
    }
    await ctx.db.patch(suggestionId, {
      status: "ACCEPTED",
      reviewer: owner,
      reviewedAt: now,
      reviewNote: why,
    });
    await pushEvent(
      ctx.db,
      inv,
      "correlation",
      "Relationship confirmed",
      `${s.source.label} → ${s.target.label} · ${s.relation}`,
      now,
    );
    await pushLog(
      ctx.db,
      inv,
      "success",
      `Confirmed relationship · ${s.source.label} → ${s.target.label} (suggestion approved by investigator)`,
      now,
    );
    return { status: "ACCEPTED" as const };
  },
});
