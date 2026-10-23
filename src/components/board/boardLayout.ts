import type {
  EvidenceGraph,
  GraphEdge,
  GraphMessageData,
  GraphNode,
} from "@/types/evidenceGraph";

/**
 * Pure layout + neighborhood logic for the evidence board.
 *
 * The board consumes the backend graph contract
 * (`evidenceGraph.getByInvestigation`) directly: nodes are persisted records,
 * edges are backend-provided relationships. This module only positions them
 * and computes selection neighborhoods — it never invents a node or a
 * relationship.
 */

export type BoardSelection =
  | { kind: "message" | "indicator" | "tactic" | "evidence"; id: string }
  | { kind: "edge"; id: string }
  | null;

export type NodeKind = "message" | "indicator" | "tactic" | "evidence";

export interface BaseNode {
  key: string;
  kind: NodeKind;
  id: string;
  x: number;
  y: number;
}

export const NODE_SIZE = {
  message: { w: 210, h: 64 },
  indicator: { w: 196, h: 60 },
  evidence: { w: 204, h: 64 },
  tactic: { w: 172, h: 56 },
} as const;

// Four bands: tactics (left) → messages (spine) → indicators → evidence (right).
export const TA_X = 20;
export const MSG_X = 300;
export const IND_X = 652;
export const EVI_X = 898;
export const ROW_GAP = 96;
export const TOP = 26;

export function sourceAnchor(
  kind: NodeKind,
  x: number,
  y: number,
  side: "left" | "right",
): { x: number; y: number } {
  const size = NODE_SIZE[kind];
  return {
    x: side === "right" ? x + size.w : x,
    y: y + size.h / 2,
  };
}

/**
 * Hanging-string thread between two anchor points — a gentle downward sag,
 * like a pin-to-pin string on a physical evidence board. Deterministic: same
 * endpoints always produce the same curve.
 */
export function threadPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const dx = Math.abs(to.x - from.x);
  const sag = Math.min(26, 10 + dx * 0.06);
  const span = to.x - from.x;
  const c1 = { x: from.x + span * 0.35, y: from.y + sag };
  const c2 = { x: from.x + span * 0.65, y: to.y + sag };
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
}

/**
 * Deterministic pinned-card tilt (±0.9°) derived from the node id — cards on
 * a physical evidence board are never perfectly square to the grid.
 */
export function pinTilt(id: string): number {
  let h = 7;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return ((h % 181) - 90) / 100;
}

/** Index backend edges once for layout + neighborhoods. */
export interface EdgeIndex {
  /** indicator id → message id (EXTRACTED_FROM) */
  extractedFrom: Map<string, string>;
  /** tactic id → message id (DETECTED_IN) */
  detectedIn: Map<string, string>;
  /** indicator id → evidence id (PRESERVED_AS) */
  preservedAs: Map<string, string>;
  /** evidence id → indicator id (PRESERVED_AS, reversed) */
  preservedFrom: Map<string, string>;
}

export function indexEdges(graph: EvidenceGraph): EdgeIndex {
  const idx: EdgeIndex = {
    extractedFrom: new Map(),
    detectedIn: new Map(),
    preservedAs: new Map(),
    preservedFrom: new Map(),
  };
  for (const e of graph.edges) {
    if (e.type === "EXTRACTED_FROM") idx.extractedFrom.set(e.from, e.to);
    else if (e.type === "DETECTED_IN") idx.detectedIn.set(e.from, e.to);
    else if (e.type === "PRESERVED_AS") {
      idx.preservedAs.set(e.from, e.to);
      idx.preservedFrom.set(e.to, e.from);
    }
  }
  return idx;
}

/**
 * Deterministic four-band layout driven entirely by backend graph data:
 * tactic band (left) → message spine → indicator band → preserved-evidence
 * band (right). Records without resolvable relationships sit in an unlinked
 * row at the bottom — no edge is ever fabricated for them.
 */
export function computeGraphLayout(graph: EvidenceGraph): {
  nodes: Record<string, BaseNode>;
  width: number;
  height: number;
} {
  const nodes: Record<string, BaseNode> = {};
  const idx = indexEdges(graph);

  const messageNumber = (n: GraphNode) =>
    (n.data as GraphMessageData).messageNumber;
  const messages = [...graph.nodes]
    .filter((n) => n.type === "message")
    .sort((a, b) => messageNumber(a) - messageNumber(b) || a.id.localeCompare(b.id));

  const msgY = new Map<string, number>();
  messages.forEach((m, i) => {
    const y = TOP + i * ROW_GAP;
    msgY.set(m.id, y);
    nodes[m.id] = { key: m.id, kind: "message", id: m.id, x: MSG_X, y };
  });

  const unlinkedBaseY = TOP + messages.length * ROW_GAP + 24;
  let unlinkedRow = 0;
  const nextUnlinkedY = () => unlinkedBaseY + unlinkedRow++ * 78;

  // Indicators — right of the message they were extracted from (EXTRACTED_FROM).
  const indicators = graph.nodes.filter((n) => n.type === "indicator");
  const sibCount = new Map<string, number>();
  for (const ind of indicators) {
    const msgId = idx.extractedFrom.get(ind.id) ?? null;
    const baseY = msgId !== null ? msgY.get(msgId) : undefined;
    let y: number;
    if (baseY !== undefined) {
      const sib = sibCount.get(msgId!) ?? 0;
      sibCount.set(msgId!, sib + 1);
      y = baseY + sib * 78;
    } else {
      y = nextUnlinkedY();
    }
    nodes[ind.id] = { key: ind.id, kind: "indicator", id: ind.id, x: IND_X, y };
  }

  // Preserved evidence — same row as its indicator (PRESERVED_AS).
  for (const evi of graph.nodes) {
    if (evi.type !== "evidence") continue;
    const indId = idx.preservedFrom.get(evi.id) ?? null;
    const anchor = indId !== null ? nodes[indId] : undefined;
    nodes[evi.id] = {
      key: evi.id,
      kind: "evidence",
      id: evi.id,
      x: EVI_X,
      y: anchor ? anchor.y : nextUnlinkedY(),
    };
  }

  // Tactics — left of the message they were detected in (DETECTED_IN).
  const tactics = graph.nodes.filter((n) => n.type === "tactic");
  const taSib = new Map<string, number>();
  for (const ta of tactics) {
    const msgId = idx.detectedIn.get(ta.id) ?? null;
    const baseY = msgId !== null ? msgY.get(msgId) : undefined;
    let y: number;
    if (baseY !== undefined) {
      const sib = taSib.get(msgId!) ?? 0;
      taSib.set(msgId!, sib + 1);
      y = baseY + sib * 66;
    } else {
      y = nextUnlinkedY();
    }
    nodes[ta.id] = { key: ta.id, kind: "tactic", id: ta.id, x: TA_X, y };
  }

  const ys = Object.values(nodes).map((n) => n.y + NODE_SIZE[n.kind].h);
  return {
    nodes,
    width: EVI_X + NODE_SIZE.evidence.w + 60,
    height: Math.max(...ys, 320) + 80,
  };
}

/**
 * Selection neighborhood — the selected record plus every node directly
 * connected by a backend edge. Selecting an edge highlights its two
 * endpoints. One hop only: relationships are never followed speculatively.
 */
export function neighborsOf(
  graph: EvidenceGraph,
  selected: BoardSelection,
): { nodes: Set<string>; edges: Set<string> } | null {
  if (!selected) return null;
  if (selected.kind === "edge") {
    const edge = graph.edges.find((e) => e.id === selected.id);
    if (!edge) return null;
    return { nodes: new Set([edge.from, edge.to]), edges: new Set([edge.id]) };
  }
  const nodes = new Set<string>([selected.id]);
  const edges = new Set<string>();
  for (const e of graph.edges) {
    if (e.from === selected.id || e.to === selected.id) {
      edges.add(e.id);
      nodes.add(e.from);
      nodes.add(e.to);
    }
  }
  return { nodes, edges };
}

/** Edge lookup by stable id. */
export function edgeById(graph: EvidenceGraph, id: string): GraphEdge | null {
  return graph.edges.find((e) => e.id === id) ?? null;
}

/** Node lookup by stable id. */
export function nodeById(graph: EvidenceGraph, id: string): GraphNode | null {
  return graph.nodes.find((n) => n.id === id) ?? null;
}
