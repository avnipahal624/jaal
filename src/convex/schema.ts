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
);

const scamCategoryValidator = v.union(v.literal("Digital arrest scam"), v.literal("UPI/payment scam"), v.literal("Phishing"), v.literal("Impersonation"), v.literal("Job scam"), v.literal("Investment scam"), v.literal("Other"));
const detectionModeValidator = v.union(v.literal("simulation"), v.literal("balanced"), v.literal("manual"));
const stageIdValidator = v.union(v.literal("contact"), v.literal("authority"), v.literal("fear"), v.literal("payment"), v.literal("exploit"));
const tacticIdValidator = v.union(v.literal("authority_impersonation"), v.literal("fear_threat"), v.literal("urgency"), v.literal("payment_request"), v.literal("isolation"), v.literal("remote_access"));
const killChainStageValidator = v.object({
  id: stageIdValidator,
  number: v.number(),
  label: v.string(),
  description: v.string(),
  status: v.union(v.literal("pending"), v.literal("active"), v.literal("detected"), v.literal("completed")),
  detectedAt: v.union(v.number(), v.null()),
  messageIds: v.array(v.string()),
  tactics: v.array(tacticIdValidator),
  reason: v.string(),
});
const analysisTacticValidator = v.object({
  tacticCode: tacticIdValidator,
  displayName: v.string(),
  explanation: v.string(),
});
const appearanceSettingsValidator = v.object({
  theme: v.optional(v.literal("dark")),
  density: v.optional(v.union(v.literal("compact"), v.literal("comfortable"))),
  animationIntensity: v.optional(v.union(v.literal("subtle"), v.literal("standard"), v.literal("vivid"))),
  reducedMotion: v.optional(v.boolean()),
});
const investigationSettingsValidator = v.object({
  defaultCategory: v.optional(scamCategoryValidator),
  defaultDetectionMode: v.optional(detectionModeValidator),
  autoExtract: v.optional(v.boolean()),
  autoHash: v.optional(v.boolean()),
  aiSuggestions: v.optional(v.boolean()),
});
const simulationSettingsValidator = v.object({ simulatedActivity: v.optional(v.boolean()) });
const reportSummaryValidator = v.object({
  scenario: v.string(),
  tactics: v.string(),
  payment: v.string(),
  moments: v.array(v.object({ timestamp: v.number(), label: v.string(), text: v.string() })),
  engineLabel: v.optional(v.string()),
});
const reportDataValidator = v.object({
  id: v.string(), caseId: v.string(), title: v.string(), category: scamCategoryValidator,
  generatedAt: v.number(), generatedBy: v.string(), simulated: v.boolean(),
  status: v.union(v.literal("active"), v.literal("completed"), v.literal("archived")),
  currentStage: stageIdValidator, evidenceCount: v.number(),
  integrity: v.object({ collected: v.number(), hashed: v.number(), verified: v.number(), mismatched: v.number(), unhashed: v.number() }),
  description: v.string(), summary: reportSummaryValidator, unknowns: v.array(v.string()),
  transcript: v.array(v.object({ author: v.string(), text: v.string(), timestamp: v.number() })),
  tactics: v.array(v.object({
    tactic: tacticIdValidator, name: v.string(), timestamp: v.number(), sourceText: v.string(), explanation: v.string(),
    messageId: v.optional(v.union(v.string(), v.null())), messageNumber: v.optional(v.union(v.number(), v.null())),
  })),
  stages: v.array(v.object({
    id: stageIdValidator, number: v.number(), label: v.string(), status: v.string(),
    detectedAt: v.union(v.number(), v.null()), reason: v.string(),
  })),
  evidence: v.array(v.object({
    id: v.string(), type: v.string(), label: v.string(), value: v.string(), extractedAt: v.number(),
    hash: v.union(v.string(), v.null()), hashStatus: v.string(),
    review: v.object({ status: v.union(v.string(), v.null()), note: v.union(v.string(), v.null()), reviewedAt: v.union(v.number(), v.null()) }),
    sourceMessageId: v.optional(v.union(v.string(), v.null())),
    sourceMessageNumber: v.optional(v.union(v.number(), v.null())),
  })),
  timeline: v.array(v.object({ timestamp: v.number(), kind: v.string(), title: v.string(), detail: v.string() })),
  verification: v.array(v.object({ id: v.string(), label: v.string(), hash: v.union(v.string(), v.null()), status: v.string(), note: v.string() })),
  analystNotes: v.string(),
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
      /** Subject from the authenticated Convex identity. */
      owner: v.string(),
      title: v.string(),
      category: scamCategoryValidator,
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
      detectionMode: detectionModeValidator,
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
      stages: v.array(killChainStageValidator),
      schemaVersion: v.number(),
    })
      .index("by_owner", ["owner"])
      .index("by_owner_activity", ["owner", "lastActivityAt"])
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
    })
      .index("by_investigation", ["investigationId"])
      .index("by_investigation_timestamp", ["investigationId", "timestamp"]),

    /** Per-message tactic analysis results (structured JSON). */
    analyses: defineTable({
      investigationId: v.id("investigations"),
      owner: v.string(),
      messageId: v.string(),
      intent: v.string(),
      tactics: v.array(analysisTacticValidator),
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
      integrityHash: v.optional(v.string()),
      integrityAlgorithm: v.optional(v.string()),
      integrityStatus: integrityStatusValidator,
      hashGeneratedAt: v.optional(v.number()),
      notes: v.string(),
      tampered: v.optional(v.boolean()),
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
    })
      .index("by_investigation", ["investigationId"])
      .index("by_investigation_timestamp", ["investigationId", "timestamp"]),

    /** Log lines (info/warn/success/error) for the console streams. */
    logs: defineTable({
      investigationId: v.id("investigations"),
      owner: v.string(),
      caseId: v.string(),
      level: v.string(),
      message: v.string(),
      timestamp: v.number(),
    })
      .index("by_investigation", ["investigationId"])
      .index("by_investigation_timestamp", ["investigationId", "timestamp"]),

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
      summary: v.union(v.string(), reportSummaryValidator),
      reportData: reportDataValidator,
      generatedAt: v.number(),
      reportStatus: v.string(),
      simulated: v.boolean(),
    })
      .index("by_owner", ["owner"])
      .index("by_owner_generated", ["owner", "generatedAt"])
      .index("by_owner_report_id", ["owner", "reportId"])
      .index("by_investigation", ["investigationId"]),

    /** Per-user settings (appearance / investigation / simulation). */
    settings: defineTable({
      owner: v.string(),
      appearance: appearanceSettingsValidator,
      investigation: investigationSettingsValidator,
      simulation: simulationSettingsValidator,
      updatedAt: v.number(),
    }).index("by_owner", ["owner"]),
  },
  {
    // Validate all explicitly typed fields on writes. Flexible payload fields
    // flexible persisted values now have explicit validators.
    schemaValidation: true,
  },
);

export default schema;
