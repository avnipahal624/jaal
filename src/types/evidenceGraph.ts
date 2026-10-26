/**
 * JAAL evidence graph — wire contract.
 *
 * A read-only projection of persisted investigation records into a node/edge
 * graph for the evidence board. It is never a source of truth: nodes map 1:1
 * to existing rows, and every edge cites the persisted record that
 * establishes it.
 */

export const EVIDENCE_GRAPH_VERSION = 1;

export type GraphNodeType =
  | "message"
  | "indicator"
  | "tactic"
  | "evidence";

export type GraphEdgeType =
  | "EXTRACTED_FROM"
  | "DETECTED_IN"
  | "PRESERVED_AS"
  | "ASSOCIATED_WITH";

export interface GraphMessageData {
  sender: "scammer" | "decoy" | "system";
  messageNumber: number;
  content: string;
  source: string;
}

export interface GraphIndicatorData {
  evidenceType: string;
  value: string;
  normalizedValue: string;
  extractionMethod: string;
}

export interface GraphTacticData {
  tactic: string;
  explanation: string;
  sourceText: string;
  messageId: string | null;
}

export interface GraphEvidenceData {
  label: string;
  evidenceType: string;
  value: string;
  content: string;
  integrity: {
    algorithm: string | null;
    hash: string | null;
    status: string;
    hashGeneratedAt: number | null;
    tampered: boolean;
  };
  review: {
    status: string | null;
    note: string | null;
    reviewedAt: number | null;
  };
}

type GraphNodeBase = {
  /** Stable: `${prefix}:${persisted record id}` — prefix per node type. */
  id: string;
  /** Persisted Convex record id this node projects. */
  recordId: string;
  label: string;
  timestamp: number;
};

export type GraphNode =
  | (GraphNodeBase & { type: "message"; data: GraphMessageData })
  | (GraphNodeBase & { type: "indicator"; data: GraphIndicatorData })
  | (GraphNodeBase & { type: "tactic"; data: GraphTacticData })
  | (GraphNodeBase & { type: "evidence"; data: GraphEvidenceData });

export interface GraphEdge {
  /** Stable: `${type}:${from}->${to}`. */
  id: string;
  type: GraphEdgeType;
  from: string;
  to: string;
  /** Persisted record that establishes this relationship. */
  sourceRecordId: string;
  /** Documented, human-readable relationship basis (from persisted fields). */
  basis: string;
  timestamp: number;
}

export interface EvidenceGraph {
  /** The human case id (e.g. "JAAL-001"). */
  investigationId: string;
  version: number;
  generatedAt: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
