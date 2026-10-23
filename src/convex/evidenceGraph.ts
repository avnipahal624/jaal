import { v } from "convex/values";
import { query } from "./_generated/server";
import { getOwner } from "./lib/backend";
import { TACTIC_META } from "@/services/investigationService";
import {
  EVIDENCE_GRAPH_VERSION,
  type EvidenceGraph,
  type GraphEdge,
  type GraphNode,
} from "@/types/evidenceGraph";

/**
 * EVIDENCE GRAPH — read-only projection of persisted records.
 *
 * `evidenceGraph.getByInvestigation` assembles a node/edge graph from the
 * existing tables (messages, tactics, evidence). It introduces no new storage
 * and is never a source of truth: every node maps 1:1 to a persisted row, and
 * every edge cites the persisted record that establishes it (`sourceRecordId`)
 * with a documented basis (`basis`).
 *
 * Node types:  message (messages), indicator + evidence (two aspects of one
 *              evidence row), tactic (tactics).
 * Edge types:  EXTRACTED_FROM  indicator → message  (evidence.sourceMessageId)
 *              DETECTED_IN     tactic    → message  (tactics.messageId)
 *              PRESERVED_AS    indicator → evidence (same evidence row)
 *              ASSOCIATED_WITH indicator → indicator (co-extracted from the
 *                              same resolvable message)
 *
 * Relationships whose source record does not resolve are dropped — never
 * emitted. Access is owner-scoped through the same `by_owner_case` lookup the
 * rest of the backend uses; unknown or foreign cases yield an empty graph.
 */

const nodeValidator = v.object({
  id: v.string(),
  type: v.union(
    v.literal("message"),
    v.literal("indicator"),
    v.literal("tactic"),
    v.literal("evidence"),
  ),
  recordId: v.string(),
  label: v.string(),
  timestamp: v.number(),
  data: v.any(),
});

const edgeValidator = v.object({
  id: v.string(),
  type: v.union(
    v.literal("EXTRACTED_FROM"),
    v.literal("DETECTED_IN"),
    v.literal("PRESERVED_AS"),
    v.literal("ASSOCIATED_WITH"),
  ),
  from: v.string(),
  to: v.string(),
  sourceRecordId: v.string(),
  basis: v.string(),
  timestamp: v.number(),
});

const TYPE_ORDER: Record<GraphNode["type"], number> = {
  message: 0,
  indicator: 1,
  tactic: 2,
  evidence: 3,
};

function emptyGraph(investigationId: string): EvidenceGraph {
  return {
    investigationId,
    version: EVIDENCE_GRAPH_VERSION,
    generatedAt: Date.now(),
    nodes: [],
    edges: [],
  };
}

export const getByInvestigation = query({
  args: { investigationId: v.string() },
  returns: v.object({
    investigationId: v.string(),
    version: v.number(),
    generatedAt: v.number(),
    nodes: v.array(nodeValidator),
    edges: v.array(edgeValidator),
  }),
  handler: async (ctx, { investigationId }): Promise<EvidenceGraph> => {
    const owner = await getOwner(ctx);
    const inv = await ctx.db
      .query("investigations")
      .withIndex("by_owner_case", (q) =>
        q.eq("owner", owner).eq("caseId", investigationId),
      )
      .unique();
    // Unknown or foreign case → empty graph (access enforced by the scoped lookup).
    if (!inv) return emptyGraph(investigationId);

    const [messageDocs, tacticDocs, evidenceDocs] = await Promise.all([
      ctx.db
        .query("messages")
        .withIndex("by_investigation", (q) =>
          q.eq("investigationId", inv._id),
        )
        .collect(),
      ctx.db
        .query("tactics")
        .withIndex("by_investigation", (q) =>
          q.eq("investigationId", inv._id),
        )
        .collect(),
      ctx.db
        .query("evidence")
        .withIndex("by_investigation", (q) =>
          q.eq("investigationId", inv._id),
        )
        .collect(),
    ]);

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // ---- Message nodes (system separator lines carry no case content) ----
    const messages = messageDocs
      .filter((m) => m.owner === owner && m.sender !== "system")
      .sort((a, b) => a.messageNumber - b.messageNumber);
    const messageIds = new Set(messages.map((m) => m._id as string));
    const messageTimestamp = new Map(
      messages.map((m) => [m._id as string, m.timestamp]),
    );
    for (const m of messages) {
      nodes.push({
        id: `msg:${m._id}`,
        type: "message",
        recordId: m._id,
        label: `MSG #${String(m.messageNumber).padStart(2, "0")} · ${m.sender}`,
        timestamp: m.timestamp,
        data: {
          sender: m.sender,
          messageNumber: m.messageNumber,
          content: m.content,
          source: m.source,
        },
      });
    }

    // ---- Indicator + evidence nodes (two aspects of one evidence row) ----
    const evidence = evidenceDocs.filter((e) => e.owner === owner);
    // Co-extraction groups: evidence rows sharing one resolvable source message.
    const bySourceMessage = new Map<string, string[]>();
    for (const e of evidence) {
      nodes.push({
        id: `ind:${e._id}`,
        type: "indicator",
        recordId: e._id,
        label: e.label,
        timestamp: e.extractionTimestamp,
        data: {
          evidenceType: e.evidenceType,
          value: e.extractedValue,
          normalizedValue: e.normalizedValue,
          extractionMethod: e.extractionMethod,
        },
      });
      nodes.push({
        id: `evi:${e._id}`,
        type: "evidence",
        recordId: e._id,
        label: e.label,
        timestamp: e.extractionTimestamp,
        data: {
          label: e.label,
          evidenceType: e.evidenceType,
          value: e.extractedValue,
          content: e.content,
          integrity: {
            algorithm: e.integrityAlgorithm ?? null,
            hash: e.integrityHash ?? null,
            status: e.integrityStatus,
            hashGeneratedAt: e.hashGeneratedAt ?? null,
            tampered: e.tampered === true,
          },
          review: {
            status: e.reviewStatus ?? null,
            note: e.reviewNote ?? null,
            reviewedAt: e.reviewedAt ?? null,
          },
        },
      });

      // PRESERVED_AS — the extracted indicator is preserved as the artifact.
      edges.push({
        id: `PRESERVED_AS:ind:${e._id}->evi:${e._id}`,
        type: "PRESERVED_AS",
        from: `ind:${e._id}`,
        to: `evi:${e._id}`,
        sourceRecordId: e._id,
        basis: `Indicator "${e.label}: ${e.extractedValue}" is preserved as evidence content snapshot (${e.integrityStatus}${e.integrityHash ? " · SHA-256 recorded" : ""}).`,
        timestamp: e.extractionTimestamp,
      });

      // EXTRACTED_FROM — only when the source message actually resolves.
      if (e.sourceMessageId && messageIds.has(e.sourceMessageId)) {
        edges.push({
          id: `EXTRACTED_FROM:ind:${e._id}->msg:${e.sourceMessageId}`,
          type: "EXTRACTED_FROM",
          from: `ind:${e._id}`,
          to: `msg:${e.sourceMessageId}`,
          sourceRecordId: e._id,
          basis: `${e.extractionMethod} extracted "${e.label}: ${e.extractedValue}" from this message (evidence.sourceMessageId).`,
          timestamp: e.extractionTimestamp,
        });
        const group = bySourceMessage.get(e.sourceMessageId) ?? [];
        group.push(`ind:${e._id}`);
        bySourceMessage.set(e.sourceMessageId, group);
      }
    }

    // ASSOCIATED_WITH — indicator pairs co-extracted from the same message.
    for (const [sourceMessageId, indicators] of bySourceMessage) {
      if (indicators.length < 2) continue;
      const sorted = [...indicators].sort();
      const ts = messageTimestamp.get(sourceMessageId) ?? 0;
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const [a, b] = [sorted[i]!, sorted[j]!];
          edges.push({
            id: `ASSOCIATED_WITH:${a}->${b}`,
            type: "ASSOCIATED_WITH",
            from: a,
            to: b,
            sourceRecordId: sourceMessageId,
            basis:
              "Both indicators were extracted from the same persisted message (shared evidence.sourceMessageId).",
            timestamp: ts,
          });
        }
      }
    }

    // ---- Tactic nodes + DETECTED_IN ----
    for (const t of tacticDocs.filter((d) => d.owner === owner)) {
      nodes.push({
        id: `tac:${t._id}`,
        type: "tactic",
        recordId: t._id,
        label: TACTIC_META[t.tactic as keyof typeof TACTIC_META]?.name ?? t.tactic,
        timestamp: t.timestamp,
        data: {
          tactic: t.tactic,
          explanation: t.explanation,
          sourceText: t.sourceText,
          messageId: t.messageId ?? null,
        },
      });
      if (t.messageId && messageIds.has(t.messageId)) {
        edges.push({
          id: `DETECTED_IN:tac:${t._id}->msg:${t.messageId}`,
          type: "DETECTED_IN",
          from: `tac:${t._id}`,
          to: `msg:${t.messageId}`,
          sourceRecordId: t._id,
          basis: `Tactic "${t.tactic}" detected in this message content (tactics.messageId): ${t.explanation}`,
          timestamp: t.timestamp,
        });
      }
    }

    // Deterministic ordering for stable contracts across regenerations.
    nodes.sort(
      (a, b) =>
        TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.id.localeCompare(b.id),
    );
    edges.sort((a, b) => a.id.localeCompare(b.id));

    return {
      investigationId,
      version: EVIDENCE_GRAPH_VERSION,
      generatedAt: Date.now(),
      nodes,
      edges,
    };
  },
});
