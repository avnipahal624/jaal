import { describe, expect, it } from "vitest";
import {
  NODE_SIZE,
  computeGraphLayout,
  edgeById,
  indexEdges,
  neighborsOf,
  nodeById,
  pinTilt,
  sourceAnchor,
  threadPath,
} from "./boardLayout";
import type {
  EvidenceGraph,
  GraphEdge,
  GraphNode,
} from "@/types/evidenceGraph";

/**
 * Board layout tests — the board positions the backend graph contract; these
 * verify band placement, relationship-driven positioning, determinism and
 * selection neighborhoods against a synthetic EvidenceGraph fixture.
 */

function msg(id: string, n: number): GraphNode {
  return {
    id,
    type: "message",
    recordId: id.slice(4),
    label: `MSG #${String(n).padStart(2, "0")}`,
    timestamp: n,
    data: {
      sender: n % 2 ? "scammer" : "decoy",
      messageNumber: n,
      content: `text ${id}`,
      source: "SIM-ENGINE",
    },
  };
}

function ind(id: string): GraphNode {
  return {
    id,
    type: "indicator",
    recordId: id.slice(4),
    label: "UPI ID",
    timestamp: 10,
    data: {
      evidenceType: "upi",
      value: `v-${id}`,
      normalizedValue: `v-${id}`,
      extractionMethod: "TEST",
    },
  };
}

function evi(id: string): GraphNode {
  return {
    id,
    type: "evidence",
    recordId: id.slice(4),
    label: "UPI ID",
    timestamp: 10,
    data: {
      label: "UPI ID",
      evidenceType: "upi",
      value: `v-${id}`,
      content: `c-${id}`,
      integrity: {
        algorithm: null,
        hash: null,
        status: "NOT_HASHED",
        hashGeneratedAt: null,
        tampered: false,
      },
      review: { status: null, note: null, reviewedAt: null },
    },
  };
}

function tac(id: string): GraphNode {
  return {
    id,
    type: "tactic",
    recordId: id.slice(4),
    label: "Urgency",
    timestamp: 10,
    data: {
      tactic: "urgency",
      explanation: "pressure",
      sourceText: "now",
      messageId: null,
    },
  };
}

function edge(
  type: GraphEdge["type"],
  from: string,
  to: string,
  sourceRecordId = "rec-1",
): GraphEdge {
  return {
    id: `${type}:${from}->${to}`,
    type,
    from,
    to,
    sourceRecordId,
    basis: "test basis",
    timestamp: 10,
  };
}

function graph(nodes: GraphNode[], edges: GraphEdge[]): EvidenceGraph {
  return {
    investigationId: "JAAL-T1",
    version: 1,
    generatedAt: 1,
    nodes,
    edges,
  };
}

describe("computeGraphLayout", () => {
  it("positions all four node types in deterministic bands", () => {
    const g = graph(
      [msg("msg:m1", 1), ind("ind:e1"), evi("evi:e1"), tac("tac:t1")],
      [],
    );
    const { nodes } = computeGraphLayout(g);
    expect(Object.keys(nodes).sort()).toEqual([
      "evi:e1",
      "ind:e1",
      "msg:m1",
      "tac:t1",
    ]);
    expect(nodes["tac:t1"]!.x).toBeLessThan(nodes["msg:m1"]!.x);
    expect(nodes["msg:m1"]!.x).toBeLessThan(nodes["ind:e1"]!.x);
    expect(nodes["ind:e1"]!.x).toBeLessThan(nodes["evi:e1"]!.x);
  });

  it("creates a layout node for every backend node — nothing invented, nothing dropped", () => {
    const g = graph(
      [
        msg("msg:m1", 1),
        msg("msg:m2", 2),
        ind("ind:e1"),
        evi("evi:e1"),
        tac("tac:t1"),
        ind("ind:orphan"),
      ],
      [edge("EXTRACTED_FROM", "ind:e1", "msg:m1"), edge("PRESERVED_AS", "ind:e1", "evi:e1")],
    );
    const { nodes } = computeGraphLayout(g);
    expect(new Set(Object.keys(nodes))).toEqual(
      new Set(g.nodes.map((n) => n.id)),
    );
  });

  it("anchors indicators to their extraction message (EXTRACTED_FROM) and evidence to its indicator (PRESERVED_AS)", () => {
    const g = graph(
      [msg("msg:m1", 1), ind("ind:e1"), evi("evi:e1")],
      [
        edge("EXTRACTED_FROM", "ind:e1", "msg:m1"),
        edge("PRESERVED_AS", "ind:e1", "evi:e1"),
      ],
    );
    const { nodes } = computeGraphLayout(g);
    // Same vertical band as the source message; evidence shares the indicator row.
    expect(nodes["ind:e1"]!.y).toBe(nodes["msg:m1"]!.y);
    expect(nodes["evi:e1"]!.y).toBe(nodes["ind:e1"]!.y);
  });

  it("stacks co-extracted indicators on the same message without overlap", () => {
    const g = graph(
      [msg("msg:m1", 1), ind("ind:a"), ind("ind:b"), ind("ind:c")],
      [
        edge("EXTRACTED_FROM", "ind:a", "msg:m1"),
        edge("EXTRACTED_FROM", "ind:b", "msg:m1"),
        edge("EXTRACTED_FROM", "ind:c", "msg:m1"),
      ],
    );
    const { nodes } = computeGraphLayout(g);
    const ys = [nodes["ind:a"]!.y, nodes["ind:b"]!.y, nodes["ind:c"]!.y];
    expect(new Set(ys).size).toBe(3);
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(nodes["msg:m1"]!.y);
    }
  });

  it("places unlinked records in the bottom row without fabricating anchors", () => {
    const g = graph([msg("msg:m1", 1), ind("ind:orphan")], []);
    const { nodes } = computeGraphLayout(g);
    expect(nodes["ind:orphan"]!.y).toBeGreaterThan(
      nodes["msg:m1"]!.y + NODE_SIZE.message.h,
    );
  });

  it("is deterministic for identical input", () => {
    const g = graph(
      [msg("msg:m1", 1), msg("msg:m2", 2), ind("ind:e1")],
      [edge("EXTRACTED_FROM", "ind:e1", "msg:m2")],
    );
    expect(computeGraphLayout(g)).toEqual(computeGraphLayout(g));
  });

  it("sizes the canvas to contain every node", () => {
    const g = graph(
      [msg("msg:m1", 1), ind("ind:e1"), evi("evi:e1"), tac("tac:t1")],
      [],
    );
    const { nodes, width, height } = computeGraphLayout(g);
    for (const n of Object.values(nodes)) {
      expect(n.x + NODE_SIZE[n.kind].w).toBeLessThanOrEqual(width);
      expect(n.y + NODE_SIZE[n.kind].h).toBeLessThanOrEqual(height);
    }
  });
});

describe("neighborsOf — selection follows backend edges only", () => {
  const g = graph(
    [msg("msg:m1", 1), ind("ind:e1"), evi("evi:e1"), tac("tac:t1"), ind("ind:x")],
    [
      edge("EXTRACTED_FROM", "ind:e1", "msg:m1"),
      edge("PRESERVED_AS", "ind:e1", "evi:e1"),
      edge("DETECTED_IN", "tac:t1", "msg:m1"),
    ],
  );

  it("returns null for no selection", () => {
    expect(neighborsOf(g, null)).toBeNull();
  });

  it("selecting a message highlights its directly connected records", () => {
    const nb = neighborsOf(g, { kind: "message", id: "msg:m1" })!;
    expect([...nb.nodes].sort()).toEqual(["ind:e1", "msg:m1", "tac:t1"].sort());
    expect(nb.edges.size).toBe(2);
  });

  it("selecting an indicator highlights its message and preserved evidence", () => {
    const nb = neighborsOf(g, { kind: "indicator", id: "ind:e1" })!;
    expect(nb.nodes.has("ind:e1")).toBe(true);
    expect(nb.nodes.has("msg:m1")).toBe(true);
    expect(nb.nodes.has("evi:e1")).toBe(true);
    // One hop only — the tactic is not reached through the indicator.
    expect(nb.nodes.has("tac:t1")).toBe(false);
    expect(nb.edges.size).toBe(2);
  });

  it("an unlinked indicator highlights only itself", () => {
    const nb = neighborsOf(g, { kind: "indicator", id: "ind:x" })!;
    expect([...nb.nodes]).toEqual(["ind:x"]);
    expect(nb.edges.size).toBe(0);
  });

  it("selecting an edge highlights its two endpoints and the edge", () => {
    const nb = neighborsOf(g, {
      kind: "edge",
      id: "EXTRACTED_FROM:ind:e1->msg:m1",
    })!;
    expect([...nb.nodes].sort()).toEqual(["ind:e1", "msg:m1"]);
    expect([...nb.edges]).toEqual(["EXTRACTED_FROM:ind:e1->msg:m1"]);
  });

  it("selecting a stale edge id returns null (dropped when record disappears)", () => {
    expect(neighborsOf(g, { kind: "edge", id: "EXTRACTED_FROM:gone->gone" })).toBeNull();
  });
});

describe("lookups", () => {
  const g = graph(
    [msg("msg:m1", 1), ind("ind:e1")],
    [edge("EXTRACTED_FROM", "ind:e1", "msg:m1")],
  );
  it("edgeById / nodeById resolve stable ids", () => {
    expect(edgeById(g, "EXTRACTED_FROM:ind:e1->msg:m1")?.type).toBe("EXTRACTED_FROM");
    expect(nodeById(g, "ind:e1")?.type).toBe("indicator");
    expect(edgeById(g, "nope")).toBeNull();
    expect(nodeById(g, "nope")).toBeNull();
  });
  it("indexEdges buckets each relationship type", () => {
    const idx = indexEdges(g);
    expect(idx.extractedFrom.get("ind:e1")).toBe("msg:m1");
    expect(idx.detectedIn.size).toBe(0);
    expect(idx.preservedAs.size).toBe(0);
  });
});

describe("threadPath — pinned string between two anchors", () => {
  it("starts at the source anchor and ends at the target anchor", () => {
    const d = threadPath({ x: 0, y: 0 }, { x: 200, y: 100 });
    expect(d.startsWith("M 0 0")).toBe(true);
    expect(d.endsWith("200 100")).toBe(true);
    expect(d).toContain("C");
  });

  it("sags downward and is deterministic", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 300, y: 0 };
    const d1 = threadPath(from, to);
    expect(d1).toEqual(threadPath(from, to));
    const controlY = Number(d1.split(",")[0].trim().split(" ").pop());
    expect(controlY).toBeGreaterThan(0);
  });

  it("caps the sag for very long threads", () => {
    const d = threadPath({ x: 0, y: 0 }, { x: 5000, y: 0 });
    const controlY = Number(d.split(",")[0].trim().split(" ").pop());
    expect(controlY).toBeLessThanOrEqual(26);
  });
});

describe("pinTilt — deterministic pinned-card angle", () => {
  it("is deterministic per id", () => {
    expect(pinTilt("msg:m1")).toEqual(pinTilt("msg:m1"));
  });

  it("stays within ±0.9 degrees", () => {
    for (const id of ["msg:m1", "ind:e2", "tac:t3", "evi:xyz-999"]) {
      expect(Math.abs(pinTilt(id))).toBeLessThanOrEqual(0.9);
    }
  });

  it("varies across ids (cards are not all tilted the same way)", () => {
    const tilts = new Set(
      ["msg:a", "msg:b", "msg:c", "msg:d", "msg:e"].map(pinTilt),
    );
    expect(tilts.size).toBeGreaterThan(1);
  });
});

describe("sourceAnchor", () => {
  it("anchors to the correct edge and vertical midpoint", () => {
    expect(sourceAnchor("message", 100, 20, "right")).toEqual({
      x: 100 + NODE_SIZE.message.w,
      y: 20 + NODE_SIZE.message.h / 2,
    });
    expect(sourceAnchor("evidence", 100, 20, "left")).toEqual({
      x: 100,
      y: 20 + NODE_SIZE.evidence.h / 2,
    });
  });
});
