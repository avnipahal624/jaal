import { describe, expect, it } from "vitest";
import {
  NODE_SIZE,
  computeLayout,
  pinTilt,
  relatedRecords,
  sourceAnchor,
  threadPath,
} from "./boardLayout";
import type { EvidenceItem } from "@/types/evidence";
import type { CaseRuntime, DetectedTactic } from "@/types/investigation";
import type { ConversationMessage } from "@/types/message";

/** Minimal runtime fixture — only the fields the board consumes. */
function makeRuntime(overrides: Partial<CaseRuntime> = {}): CaseRuntime {
  return {
    caseId: "JAAL-T1",
    messages: [],
    evidence: [],
    tactics: [],
    stages: [],
    logs: [],
    activities: [],
    cursor: 0,
    turnCount: 0,
    status: "running",
    startedAt: 0,
    endedAt: null,
    typing: false,
    exhausted: false,
    ...overrides,
  };
}

function msg(id: string, author: "scammer" | "decoy" | "system", ts: number): ConversationMessage {
  return { id, caseId: "JAAL-T1", author, text: `text ${id}`, timestamp: ts, source: "SIM-ENGINE" };
}

function ev(id: string, sourceMessageId: string | null): EvidenceItem {
  return {
    id,
    caseId: "JAAL-T1",
    type: "upi",
    label: "UPI ID",
    value: `value-${id}`,
    content: `content-${id}`,
    sourceMessageId,
    sourceMessageText: "source",
    extractedAt: 100,
    notes: "",
    hash: null,
    hashGeneratedAt: null,
    hashStatus: "none",
  };
}

function ta(id: string, messageId: string | null): DetectedTactic {
  return {
    id,
    caseId: "JAAL-T1",
    tactic: "payment_request",
    messageId,
    sourceText: "pay now",
    timestamp: 100,
    explanation: "asks for money",
  };
}

describe("computeLayout", () => {
  it("creates one node per real message and excludes system lines", () => {
    const rt = makeRuntime({
      messages: [msg("m1", "scammer", 1), msg("m2", "decoy", 2), msg("sys", "system", 3)],
    });
    const { nodes } = computeLayout(rt);
    expect(Object.keys(nodes).sort()).toEqual(["msg:m1", "msg:m2"]);
  });

  it("creates nodes for every evidence item and tactic record", () => {
    const rt = makeRuntime({
      messages: [msg("m1", "scammer", 1)],
      evidence: [ev("e1", "m1"), ev("e2", null)],
      tactics: [ta("t1", "m1"), ta("t2", null)],
    });
    const { nodes } = computeLayout(rt);
    expect(Object.keys(nodes).sort()).toEqual([
      "ev:e1",
      "ev:e2",
      "msg:m1",
      "ta:t1",
      "ta:t2",
    ]);
  });

  it("places linked evidence to the right of its source and tactics to the left", () => {
    const rt = makeRuntime({
      messages: [msg("m1", "scammer", 1)],
      evidence: [ev("e1", "m1")],
      tactics: [ta("t1", "m1")],
    });
    const { nodes } = computeLayout(rt);
    const m = nodes["msg:m1"]!;
    expect(nodes["ev:e1"]!.x).toBeGreaterThan(m.x);
    expect(nodes["ta:t1"]!.x).toBeLessThan(m.x);
  });

  it("places unlinked records below the message spine (no fabricated anchor)", () => {
    const rt = makeRuntime({
      messages: [msg("m1", "scammer", 1)],
      evidence: [ev("eX", null)],
    });
    const { nodes } = computeLayout(rt);
    const m = nodes["msg:m1"]!;
    expect(nodes["ev:eX"]!.y).toBeGreaterThan(m.y + NODE_SIZE.message.h);
  });

  it("is deterministic for identical input", () => {
    const rt = makeRuntime({
      messages: [msg("m1", "scammer", 1), msg("m2", "decoy", 2)],
      evidence: [ev("e1", "m1"), ev("e2", "m2")],
      tactics: [ta("t1", "m2")],
    });
    expect(computeLayout(rt)).toEqual(computeLayout(rt));
  });

  it("sizes the canvas to contain every node", () => {
    const rt = makeRuntime({
      messages: [msg("m1", "scammer", 1)],
      evidence: [ev("e1", "m1")],
    });
    const { nodes, width, height } = computeLayout(rt);
    for (const n of Object.values(nodes)) {
      expect(n.x + NODE_SIZE[n.kind].w).toBeLessThanOrEqual(width);
      expect(n.y + NODE_SIZE[n.kind].h).toBeLessThanOrEqual(height);
    }
  });
});

describe("relatedRecords — highlighting follows real links only", () => {
  const runtime = makeRuntime({
    messages: [msg("m1", "scammer", 1), msg("m2", "decoy", 2)],
    evidence: [ev("e1", "m1"), ev("e2", "m2"), ev("e3", null)],
    tactics: [ta("t1", "m1"), ta("t2", null)],
  });

  it("returns null for no selection", () => {
    expect(relatedRecords(runtime, null)).toBeNull();
  });

  it("selecting a message highlights its extracted evidence and tactics", () => {
    const rel = relatedRecords(runtime, { kind: "message", id: "m1" })!;
    expect([...rel.messages]).toEqual(["m1"]);
    expect([...rel.evidence]).toEqual(["e1"]);
    expect([...rel.tactics]).toEqual(["t1"]);
  });

  it("selecting evidence highlights its source message and sibling tactics", () => {
    const rel = relatedRecords(runtime, { kind: "evidence", id: "e1" })!;
    expect(rel.messages.has("m1")).toBe(true);
    expect(rel.tactics.has("t1")).toBe(true);
    expect(rel.evidence.has("e1")).toBe(true);
    // Unrelated records stay out of the highlight set.
    expect(rel.evidence.has("e2")).toBe(false);
  });

  it("evidence with no source message highlights only itself", () => {
    const rel = relatedRecords(runtime, { kind: "evidence", id: "e3" })!;
    expect([...rel.messages]).toEqual([]);
    expect([...rel.tactics]).toEqual([]);
    expect([...rel.evidence]).toEqual(["e3"]);
  });

  it("selecting a tactic highlights its supporting message and that message's evidence", () => {
    const rel = relatedRecords(runtime, { kind: "tactic", id: "t1" })!;
    expect(rel.messages.has("m1")).toBe(true);
    expect(rel.evidence.has("e1")).toBe(true);
    expect(rel.evidence.has("e2")).toBe(false);
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
    // Control points sit below the straight line (hanging string).
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
    for (const id of ["msg:m1", "ev:e2", "ta:t3", "msg:xyz-999"]) {
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
