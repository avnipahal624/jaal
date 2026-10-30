import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);

const flagsValidator = v.object({
  tacticDetection: v.boolean(),
  identifierExtraction: v.boolean(),
  integrityHashing: v.boolean(),
  aiSuggestions: v.boolean(),
});

const runStatusValidator = v.union(
  v.literal("running"),
  v.literal("paused"),
  v.literal("completed"),
);

const integrityStatusValidator = v.union(
  v.literal("NOT_HASHED"),
  v.literal("HASH_GENERATED"),
  v.literal("INTEGRITY_VERIFIED"),
  v.literal("HASH_MISMATCH"),
  // Explicit tamper-demonstration state: content was altered by the
  // authenticated operator through the simulation path. Never presented as
  // verified — verification must be re-run against the recorded hash.
  v.literal("TAMPER_SIMULATION"),
);

const historyEntryValidator = v.object({
  at: v.number(),
  by: v.string(),
  action: v.string(),
  detail: v.optional(v.string()),
  hash: v.optional(v.string()),
  status: v.optional(v.string()),
});

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // ---------------------------------------------------------------- JAAL ---

    /** One investigation (case). `caseId` is the human-readable JAAL-XXX label. */
    investigations: defineTable({
      caseId: v.string(),
      /** Identity subject of the owning user, or "demo" for simulation login. */
      owner: v.string(),
      title: v.string(),
      category: v.string(),
      description: v.string(),
      notes: v.string(),
      status: v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("archived"),
      ),
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
      flags: flagsValidator,
      currentStage: v.string(),
      createdAt: v.number(),
      lastActivityAt: v.number(),
      completedAt: v.optional(v.number()),
      // Run state (simulation cursor + CaseRuntime status).
      runStatus: runStatusValidator,
      startedAt: v.number(),
      endedAt: v.optional(v.number()),
      cursor: v.number(),
      turnCount: v.number(),
      /** KillChainStage[] as structured JSON (content-derived). */
      stages: v.any(),
      schemaVersion: v.number(),
    })
      .index("by_owner", ["owner"])
      .index("by_owner_case", ["owner", "caseId"]),

    /** Conversation messages; original content is never altered. */
    messages: defineTable({
      investigationId: v.id("investigations"),
      owner: v.string(),
      caseId: v.string(),
      messageNumber: v.number(),
      sender: v.union(v.literal("scammer"), v.literal("decoy"), v.literal("system")),
      content: v.string(),
      source: v.string(),
      timestamp: v.number(),
      status: v.optional(v.string()),
    }).index("by_investigation", ["investigationId"]),

    /** Per-message tactic analysis results (structured JSON). */
    analyses: defineTable({
      investigationId: v.id("investigations"),
      owner: v.string(),
      messageId: v.string(),
      intent: v.string(),
      tactics: v.any(),
      summary: v.string(),
      reasoningSummary: v.string(),
      engineMode: v.string(),
      createdAt: v.number(),
    }).index("by_investigation", ["investigationId"]),

    /** Detected tactics (one row per tactic+message, deduplicated). */
    tactics: defineTable({
      investigationId: v.id("investigations"),
      owner: v.string(),
      caseId: v.string(),
      tactic: v.string(),
      messageId: v.optional(v.string()),
      sourceText: v.string(),
      timestamp: v.number(),
      explanation: v.string(),
    }).index("by_investigation", ["investigationId"]),

    /** Extracted identifiers with SHA-256 integrity records. */
    evidence: defineTable({
      investigationId: v.id("investigations"),
      owner: v.string(),
      caseId: v.string(),
      sourceMessageId: v.optional(v.string()),
      sourceMessageText: v.string(),
      label: v.string(),
      evidenceType: v.string(),
      extractedValue: v.string(),
      normalizedValue: v.string(),
      /** Deterministic snapshot that gets hashed. */
      content: v.string(),
      extractionMethod: v.string(),
      extractionTimestamp: v.number(),
      /** Heuristic rule-based extraction confidence in [0,1] — review aid only. */
      confidence: v.optional(v.number()),
      integrityHash: v.optional(v.string()),
      integrityAlgorithm: v.optional(v.string()),
      integrityStatus: integrityStatusValidator,
      hashGeneratedAt: v.optional(v.number()),
      notes: v.string(),
      tampered: v.optional(v.boolean()),
      /** First (pre-tamper) snapshot — preserved so a simulation never erases the original. */
      originalContent: v.optional(v.string()),
      /** Every content mutation: { at, by, action, detail }. */
      contentHistory: v.optional(v.array(historyEntryValidator)),
      /** Every hash generation / re-baseline: { at, by, action, hash, detail }. */
      hashHistory: v.optional(v.array(historyEntryValidator)),
      /** Every verification result: { at, by, status, hash, detail }. */
      verificationHistory: v.optional(v.array(historyEntryValidator)),
      /** Deterministic canonical manifest (see buildEvidenceManifest)… */
      manifest: v.optional(v.any()),
      /** …and its SHA-256. Changes whenever any manifest field changes. */
      manifestHash: v.optional(v.string()),
      /** Analyst review verdict — stored separately from the original extraction. */
      reviewStatus: v.optional(
        v.union(
          v.literal("confirmed"),
          v.literal("incorrect"),
          v.literal("needs_review"),
        ),
      ),
      reviewNote: v.optional(v.string()),
      reviewedAt: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_investigation", ["investigationId"]),

    /** Investigation events powering the activity console. */
    events: defineTable({
      investigationId: v.id("investigations"),
      owner: v.string(),
      caseId: v.string(),
      kind: v.string(),
      title: v.string(),
      detail: v.string(),
      timestamp: v.number(),
    }).index("by_investigation", ["investigationId"]),

    /** Log lines (info/warn/success/error) for the console streams. */
    logs: defineTable({
      investigationId: v.id("investigations"),
      owner: v.string(),
      caseId: v.string(),
      level: v.string(),
      message: v.string(),
      timestamp: v.number(),
    }).index("by_investigation", ["investigationId"]),

    /** AI investigation strategy suggestions (pending = shown to operator). */
    strategies: defineTable({
      investigationId: v.id("investigations"),
      owner: v.string(),
      caseId: v.string(),
      objective: v.string(),
      informationGap: v.string(),
      suggestedQuestion: v.string(),
      reason: v.string(),
      relatedMessageIds: v.array(v.string()),
      engineMode: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("dismissed"),
        v.literal("superseded"),
        v.literal("exhausted"),
      ),
      createdAt: v.number(),
    })
      .index("by_investigation", ["investigationId"])
      .index("by_investigation_status", ["investigationId", "status"]),

    /** Generated evidence reports (full structured payload as JSON). */
    reports: defineTable({
      investigationId: v.id("investigations"),
      owner: v.string(),
      caseId: v.string(),
      reportId: v.string(),
      reportVersion: v.number(),
      summary: v.any(),
      reportData: v.any(),
      generatedAt: v.number(),
      reportStatus: v.string(),
      simulated: v.boolean(),
    })
      .index("by_owner", ["owner"])
      .index("by_investigation", ["investigationId"]),

    /**
     * AI action usage records — rolling-window rate limiting per owner.
     * Written only by the server; never exposed as a query surface.
     */
    ai_requests: defineTable({
      owner: v.string(),
      caseId: v.string(),
      kind: v.string(),
      at: v.number(),
    }).index("by_owner_at", ["owner", "at"]),

    /** Per-user settings (appearance / investigation / simulation). */
    settings: defineTable({
      owner: v.string(),
      appearance: v.any(),
      investigation: v.any(),
      simulation: v.any(),
      updatedAt: v.number(),
    }).index("by_owner", ["owner"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
