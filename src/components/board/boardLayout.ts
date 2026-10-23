import type { CaseRuntime } from "@/types/investigation";

/**
 * Pure layout + relationship logic for the evidence board.
 *
 * Extracted from the component so it can be unit-tested without a DOM. Every
 * edge in the graph corresponds to a real field in the case data (an evidence
 * item's sourceMessageId, a tactic's messageId) — this module never infers a
 * relationship that the data does not state.
 */

export type BoardSelection =
  | { kind: "message"; id: string }
  | { kind: "evidence"; id: string }
  | { kind: "tactic"; id: string }
  | null;

export type NodeKind = "message" | "evidence" | "tactic";

export interface BaseNode {
  key: string;
  kind: NodeKind;
  id: string;
  x: number;
  y: number;
}

export const NODE_SIZE = {
  message: { w: 210, h: 64 },
  evidence: { w: 200, h: 64 },
  tactic: { w: 172, h: 56 },
} as const;

export const MSG_X = 252;
export const TA_X = 20;
export const EV_X = 560;
export const ROW_GAP = 90;
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

/** Deterministic auto-layout: tactic band (left) → message spine → evidence (right). */
export function computeLayout(runtime: CaseRuntime): {
  nodes: Record<string, BaseNode>;
  width: number;
  height: number;
} {
  const nodes: Record<string, BaseNode> = {};
  const messages = runtime.messages
    .filter((m) => m.author !== "system")
    .sort((a, b) => a.timestamp - b.timestamp);

  messages.forEach((m, i) => {
    nodes[`msg:${m.id}`] = {
      key: `msg:${m.id}`,
      kind: "message",
      id: m.id,
      x: MSG_X,
      y: TOP + i * ROW_GAP,
    };
  });

  const msgY = (id: string | null) =>
    id && nodes[`msg:${id}`] ? nodes[`msg:${id}`]!.y : null;

  const groupIndex = <T extends { id: string }>(
    items: T[],
    keyOf: (item: T) => string | null,
  ): Map<string, number> => {
    const counts = new Map<string, number>();
    const out = new Map<string, number>();
    for (const item of items) {
      const k = keyOf(item) ?? "__unlinked__";
      const idx = counts.get(k) ?? 0;
      counts.set(k, idx + 1);
      out.set(item.id, idx);
    }
    return out;
  };

  // Evidence nodes — right of their source message, or in a bottom row when
  // the record has no source message (no edge is drawn for those).
  const evIdx = groupIndex(runtime.evidence, (e) => e.sourceMessageId);
  const unlinkedBaseY = TOP + messages.length * ROW_GAP + 20;
  let unlinkedEv = 0;
  let maxRight = EV_X + NODE_SIZE.evidence.w;
  runtime.evidence.forEach((e) => {
    const idx = evIdx.get(e.id) ?? 0;
    const srcY = msgY(e.sourceMessageId);
    const y = srcY !== null ? srcY + idx * 74 : unlinkedBaseY + unlinkedEv++ * 74;
    const x = srcY !== null ? EV_X + (idx % 2) * 230 : EV_X;
    nodes[`ev:${e.id}`] = { key: `ev:${e.id}`, kind: "evidence", id: e.id, x, y };
    maxRight = Math.max(maxRight, x + NODE_SIZE.evidence.w);
  });

  // Tactic nodes — left of their supporting message, or bottom-left unlinked.
  const taIdx = groupIndex(runtime.tactics, (t) => t.messageId);
  let unlinkedTa = 0;
  runtime.tactics.forEach((t) => {
    const idx = taIdx.get(t.id) ?? 0;
    const srcY = msgY(t.messageId);
    const y = srcY !== null ? srcY + idx * 66 : unlinkedBaseY + unlinkedTa++ * 66;
    nodes[`ta:${t.id}`] = { key: `ta:${t.id}`, kind: "tactic", id: t.id, x: TA_X, y };
  });

  const ys = Object.values(nodes).map((n) => n.y + NODE_SIZE[n.kind].h);
  return {
    nodes,
    width: Math.max(maxRight + 60, 960),
    height: Math.max(...ys, 320) + 80,
  };
}

/**
 * Records related to the current selection — following only real data links:
 * a selected message links its extracted evidence and detected tactics; a
 * selected evidence item or tactic links back to its source message and to the
 * sibling records of that same message.
 */
export function relatedRecords(
  runtime: CaseRuntime,
  selected: BoardSelection,
): { messages: Set<string>; evidence: Set<string>; tactics: Set<string> } | null {
  if (!selected) return null;
  const messages = new Set<string>();
  const evidence = new Set<string>();
  const tactics = new Set<string>();

  if (selected.kind === "message") {
    messages.add(selected.id);
    runtime.evidence.forEach(
      (e) => e.sourceMessageId === selected.id && evidence.add(e.id),
    );
    runtime.tactics.forEach(
      (t) => t.messageId === selected.id && tactics.add(t.id),
    );
  } else if (selected.kind === "evidence") {
    evidence.add(selected.id);
    const e = runtime.evidence.find((x) => x.id === selected.id);
    if (e?.sourceMessageId) {
      messages.add(e.sourceMessageId);
      runtime.tactics.forEach(
        (t) => t.messageId === e.sourceMessageId && tactics.add(t.id),
      );
    }
  } else {
    tactics.add(selected.id);
    const t = runtime.tactics.find((x) => x.id === selected.id);
    if (t?.messageId) {
      messages.add(t.messageId);
      runtime.evidence.forEach(
        (e) => e.sourceMessageId === t.messageId && evidence.add(e.id),
      );
    }
  }
  return { messages, evidence, tactics };
}
