import { EVIDENCE_ICON } from "@/components/evidence/EvidenceCard";
import { TACTIC_META } from "@/services/investigationService";
import { cn } from "@/lib/utils";
import type { EvidenceItem } from "@/types/evidence";
import type { CaseRuntime } from "@/types/investigation";
import { formatClock } from "@/utils/formatters";
import {
  Fingerprint,
  LayoutGrid,
  List,
  MapPin,
  MessageSquareQuote,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  NODE_SIZE,
  computeLayout,
  pinTilt,
  relatedRecords,
  sourceAnchor,
  threadPath,
  type BaseNode,
  type BoardSelection,
  type NodeKind,
} from "./boardLayout";

export type { BoardSelection } from "./boardLayout";

/**
 * EVIDENCE BOARD — the investigation's relationship graph.
 *
 * Every node is a real record from the case (message, extracted identifier,
 * detected tactic). Edges exist only where the underlying data states a
 * relationship: an evidence item's sourceMessageId, or a tactic's messageId.
 * Nothing is inferred, nothing is decorative: if the case has no linked data,
 * no line is drawn.
 *
 * Nodes can be dragged (positions are view-local overrides); "auto-layout"
 * recomputes the deterministic layout from the data. A table view mirrors the
 * board for crowded cases and small screens.
 */

interface Edge {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  link: "evidence" | "tactic";
  hot: boolean;
}

export function EvidenceBoard({
  runtime,
  selected,
  onSelect,
  onOpenEvidence,
  onOpenSource,
  messageNumbers,
  defaultView = "board",
}: {
  runtime: CaseRuntime;
  selected: BoardSelection;
  onSelect: (sel: BoardSelection) => void;
  onOpenEvidence: (evidenceId: string) => void;
  /** Jump to the source message in the conversation (chat tab / scroll). */
  onOpenSource: (messageId: string) => void;
  messageNumbers: Record<string, number>;
  defaultView?: "board" | "list";
}) {
  const [view, setView] = useState<"board" | "list">(defaultView);
  const [offsets, setOffsets] = useState<Record<string, { x: number; y: number }>>(
    {},
  );
  const dragRef = useRef<{
    key: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  const layout = useMemo(() => computeLayout(runtime), [runtime]);

  const positioned = useMemo(() => {
    const out: Record<string, BaseNode> = {};
    for (const [key, node] of Object.entries(layout.nodes)) {
      const off = offsets[key];
      out[key] = off ? { ...node, x: node.x + off.x, y: node.y + off.y } : node;
    }
    return out;
  }, [layout, offsets]);

  /** Related-record set for the current selection (real links only). */
  const related = useMemo(
    () => relatedRecords(runtime, selected),
    [runtime, selected],
  );

  const edges = useMemo<Edge[]>(() => {
    const list: Edge[] = [];
    const hotEdge = (mId: string, tId: string) =>
      related
        ? related.messages.has(mId) &&
          (related.evidence.has(tId) || related.tactics.has(tId))
        : false;
    for (const e of runtime.evidence) {
      if (!e.sourceMessageId) continue;
      const m = positioned[`msg:${e.sourceMessageId}`];
      const t = positioned[`ev:${e.id}`];
      if (!m || !t) continue;
      list.push({
        id: `e-${e.id}`,
        from: sourceAnchor("message", m.x, m.y, "right"),
        to: sourceAnchor("evidence", t.x, t.y, "left"),
        link: "evidence",
        hot: hotEdge(e.sourceMessageId, e.id),
      });
    }
    for (const t of runtime.tactics) {
      if (!t.messageId) continue;
      const m = positioned[`msg:${t.messageId}`];
      const n = positioned[`ta:${t.id}`];
      if (!m || !n) continue;
      list.push({
        id: `t-${t.id}`,
        from: sourceAnchor("tactic", n.x, n.y, "right"),
        to: sourceAnchor("message", m.x, m.y, "left"),
        link: "tactic",
        hot: hotEdge(t.messageId, t.id),
      });
    }
    return list;
  }, [runtime.evidence, runtime.tactics, positioned, related]);

  const nodeCount =
    runtime.messages.filter((m) => m.author !== "system").length +
    runtime.evidence.length +
    runtime.tactics.length;

  const dimmed = (key: string) =>
    related !== null &&
    !(key.startsWith("msg:") && related.messages.has(key.slice(4))) &&
    !(key.startsWith("ev:") && related.evidence.has(key.slice(3))) &&
    !(key.startsWith("ta:") && related.tactics.has(key.slice(3)));

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    node: BaseNode,
  ) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const off = offsets[node.key] ?? { x: 0, y: 0 };
    dragRef.current = {
      key: node.key,
      startX: e.clientX,
      startY: e.clientY,
      origX: off.x,
      origY: off.y,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    d.moved = true;
    setOffsets((prev) => ({
      ...prev,
      [d.key]: { x: d.origX + dx, y: Math.max(-22, d.origY + dy) },
    }));
  };

  const handlePointerUp = (
    _e: React.PointerEvent<HTMLDivElement>,
    node: BaseNode,
  ) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.moved) return;
    // Treat as a click (no drag movement).
    activateNode(node);
  };

  const activateNode = (node: BaseNode) => {
    if (node.kind === "evidence") {
      onSelect({ kind: "evidence", id: node.id });
      onOpenEvidence(node.id);
    } else if (node.kind === "tactic") {
      onSelect({ kind: "tactic", id: node.id });
    } else {
      onSelect({ kind: "message", id: node.id });
    }
  };

  const msgById = useMemo(
    () => new Map(runtime.messages.map((m) => [m.id, m])),
    [runtime.messages],
  );
  const evById = useMemo(
    () => new Map(runtime.evidence.map((e) => [e.id, e])),
    [runtime.evidence],
  );
  const taById = useMemo(
    () => new Map(runtime.tactics.map((t) => [t.id, t])),
    [runtime.tactics],
  );

  // ---- Empty state -------------------------------------------------------
  if (nodeCount === 0) {
    return (
      <div className="jaal-board flex h-full min-h-0 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="flex size-11 items-center justify-center border border-jborder/70 bg-jsurface">
          <Sparkles className="size-5 text-jmuted/60" />
        </span>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-jtext">
          The board is clear
        </p>
        <p className="max-w-sm text-[12px] leading-relaxed text-jmuted">
          Nodes appear as the investigation produces them: every suspect and
          decoy message becomes a node, every detected tactic links to the
          message that triggered it, and every extracted identifier links to the
          message it was taken from. Send the next decoy line or advance the
          simulation to start populating the board.
        </p>
      </div>
    );
  }

  // ---- Table view (fallback for crowded boards / small screens) ----------
  if (view === "list") {
    const rows: {
      key: string;
      kind: NodeKind;
      id: string;
      label: string;
      detail: string;
      sourceNumber?: number;
      ts: number;
    }[] = [
      ...runtime.messages
        .filter((m) => m.author !== "system")
        .map((m) => ({
          key: `msg:${m.id}`,
          kind: "message" as const,
          id: m.id,
          label: `MSG #${String(messageNumbers[m.id] ?? 0).padStart(2, "0")} · ${
            m.author === "scammer" ? "suspect" : "decoy"
          }`,
          detail: m.text,
          ts: m.timestamp,
        })),
      ...runtime.evidence.map((e) => ({
        key: `ev:${e.id}`,
        kind: "evidence" as const,
        id: e.id,
        label: e.label,
        detail: e.value,
        sourceNumber: e.sourceMessageId
          ? messageNumbers[e.sourceMessageId]
          : undefined,
        ts: e.extractedAt,
      })),
      ...runtime.tactics.map((t) => ({
        key: `ta:${t.id}`,
        kind: "tactic" as const,
        id: t.id,
        label: TACTIC_META[t.tactic]?.name ?? t.tactic,
        detail: t.explanation,
        sourceNumber: t.messageId ? messageNumbers[t.messageId] : undefined,
        ts: t.timestamp,
      })),
    ].sort((a, b) => a.ts - b.ts);

    return (
      <div className="flex h-full min-h-0 flex-col">
        <BoardToolbar
          view={view}
          setView={setView}
          onResetLayout={() => setOffsets({})}
          nodeCount={nodeCount}
          evidenceCount={runtime.evidence.length}
          tacticCount={runtime.tactics.length}
        />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-jsurface/95">
              <tr className="border-b border-jborder/60">
                {["Kind", "Node", "Detail", "Source", "Time"].map((h) => (
                  <th
                    key={h}
                    className="jaal-label !text-[8px] whitespace-nowrap px-3 py-1.5"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.key}
                  onClick={() =>
                    activateNode({
                      key: r.key,
                      kind: r.kind,
                      id: r.id,
                      x: 0,
                      y: 0,
                    })
                  }
                  className={cn(
                    "cursor-pointer border-b border-jborder/30 transition-colors hover:bg-jcyan/[0.04]",
                    selected &&
                      ((selected.kind === "message" &&
                        r.kind === "message" &&
                        selected.id === r.id) ||
                        (selected.kind === "evidence" &&
                          r.kind === "evidence" &&
                          selected.id === r.id) ||
                        (selected.kind === "tactic" &&
                          r.kind === "tactic" &&
                          selected.id === r.id)) &&
                      "bg-jcyan/[0.07]",
                  )}
                >
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <span
                      className={cn(
                        "border px-1.5 py-px font-mono text-[8px] uppercase tracking-wider",
                        r.kind === "message"
                          ? "border-jred/40 text-jred/90"
                          : r.kind === "evidence"
                            ? "border-jcyan/40 text-jcyan"
                            : "border-jamber/40 text-jamber",
                      )}
                    >
                      {r.kind}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[10px] text-jtext">
                    {r.label}
                  </td>
                  <td className="max-w-[380px] truncate px-3 py-1.5 text-[11px] text-jmuted">
                    {r.detail}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-jmuted/70">
                    {r.sourceNumber
                      ? `MSG #${String(r.sourceNumber).padStart(2, "0")}`
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[9px] text-jmuted/70">
                    {formatClock(r.ts)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ---- Graph view --------------------------------------------------------
  return (
    <div className="flex h-full min-h-0 flex-col">
      <BoardToolbar
        view={view}
        setView={setView}
        onResetLayout={() => setOffsets({})}
        nodeCount={nodeCount}
        evidenceCount={runtime.evidence.length}
        tacticCount={runtime.tactics.length}
        crowded={nodeCount > 40}
      />

      <div className="jaal-board relative min-h-0 flex-1 overflow-auto">
        <div
          className="relative"
          style={{ width: layout.width, height: layout.height }}
        >
          {/* Relationship lines — only where the data states a link. */}
          <svg
            className="pointer-events-none absolute inset-0"
            width={layout.width}
            height={layout.height}
            aria-hidden
          >
            {edges.map((edge) => {
              const tone =
                edge.link === "evidence"
                  ? {
                      line: edge.hot
                        ? "stroke-jcyan/95 [stroke-width:1.7]"
                        : "stroke-jcyan/45 [stroke-width:1]",
                      pin: "fill-jcyan",
                    }
                  : {
                      line: edge.hot
                        ? "stroke-jamber/95 [stroke-width:1.7]"
                        : "stroke-jamber/40 [stroke-width:1]",
                      pin: "fill-jamber",
                    };
              return (
                <g key={edge.id}>
                  {/* String: gentle hanging curve between the two pins */}
                  <path
                    d={threadPath(edge.from, edge.to)}
                    className={cn(
                      "fill-none transition-all duration-200",
                      tone.line,
                    )}
                  />
                  {/* Pin dots at both string ends */}
                  <circle
                    cx={edge.from.x}
                    cy={edge.from.y}
                    r={2.4}
                    className={cn(
                      "transition-opacity duration-200",
                      tone.pin,
                      edge.hot ? "opacity-100" : "opacity-60",
                    )}
                  />
                  <circle
                    cx={edge.to.x}
                    cy={edge.to.y}
                    r={edge.hot ? 3.4 : 2.8}
                    className={cn(
                      "transition-all duration-200",
                      tone.pin,
                      edge.hot ? "opacity-100" : "opacity-80",
                    )}
                  />
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          {Object.values(positioned).map((node) => {
            const isDim = dimmed(node.key);
            if (node.kind === "message") {
              const m = msgById.get(node.id);
              if (!m) return null;
              const num = messageNumbers[m.id];
              const isSel = selected?.kind === "message" && selected.id === m.id;
              const isScam = m.author === "scammer";
              return (
                <div
                  key={node.key}
                  onPointerDown={(e) => handlePointerDown(e, node)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={(e) => handlePointerUp(e, node)}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: NODE_SIZE.message.w,
                    transform: isSel ? "rotate(0deg)" : `rotate(${pinTilt(node.id)}deg)`,
                  }}
                  className={cn(
                    "jaal-board-node h-16 cursor-grab border bg-panel/95 px-2 py-1.5 transition-opacity transition-transform duration-200 active:cursor-grabbing",
                    isScam ? "border-jred/50" : "border-jcyan/50",
                    isSel &&
                      "ring-1 ring-jcyan shadow-[0_0_12px_rgba(57,214,232,0.25)]",
                    isDim && "opacity-30",
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "font-mono text-[8px] uppercase tracking-widest",
                        isScam ? "text-jred" : "text-jcyan",
                      )}
                    >
                      MSG #{String(num ?? 0).padStart(2, "0")} ·{" "}
                      {isScam ? "suspect" : "decoy"}
                    </span>
                    <span className="font-mono text-[8px] text-jmuted/60">
                      {formatClock(m.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-jtext/90">
                    {m.text}
                  </p>
                </div>
              );
            }

            if (node.kind === "evidence") {
              const ev = evById.get(node.id);
              if (!ev) return null;
              const Icon = EVIDENCE_ICON[ev.type] ?? Fingerprint;
              const isSel =
                selected?.kind === "evidence" && selected.id === ev.id;
              return (
                <div
                  key={node.key}
                  onPointerDown={(e) => handlePointerDown(e, node)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={(e) => handlePointerUp(e, node)}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: NODE_SIZE.evidence.w,
                    transform: isSel ? "rotate(0deg)" : `rotate(${pinTilt(node.id)}deg)`,
                  }}
                  className={cn(
                    "jaal-board-node h-16 cursor-grab border border-jcyan/45 bg-panel/95 px-2 py-1.5 transition-opacity transition-transform duration-200 active:cursor-grabbing",
                    isSel &&
                      "ring-1 ring-jcyan shadow-[0_0_12px_rgba(57,214,232,0.25)]",
                    ev.hashStatus === "mismatch" && "border-jred/60",
                    isDim && "opacity-30",
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex min-w-0 items-center gap-1">
                      <Icon className="size-3 shrink-0 text-jcyan" />
                      <span className="truncate font-mono text-[8px] uppercase tracking-widest text-jcyan">
                        {ev.label}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {ev.reviewStatus && (
                        <span
                          title={`analyst: ${ev.reviewStatus.replace("_", " ")}`}
                          className={cn(
                            "size-1.5",
                            ev.reviewStatus === "confirmed"
                              ? "bg-jgreen"
                              : ev.reviewStatus === "incorrect"
                                ? "bg-jred"
                                : "bg-jamber",
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          "size-1.5",
                          ev.hashStatus === "verified"
                            ? "bg-jgreen"
                            : ev.hashStatus === "mismatch"
                              ? "bg-jred"
                              : ev.hashStatus === "generated"
                                ? "bg-jcyan"
                                : "bg-jmuted/50",
                        )}
                        title={`integrity: ${ev.hashStatus}`}
                      />
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-jtext">
                    {ev.value}
                  </p>
                  <p className="mt-0.5 font-mono text-[7.5px] uppercase tracking-widest text-jmuted/60">
                    extracted · sha-256 {ev.hash ? "recorded" : "pending"}
                  </p>
                </div>
              );
            }

            const ta = taById.get(node.id);
            if (!ta) return null;
            const meta = TACTIC_META[ta.tactic];
            const isSel = selected?.kind === "tactic" && selected.id === ta.id;
            const refNum = ta.messageId ? messageNumbers[ta.messageId] : undefined;
            return (
              <div
                key={node.key}
                onPointerDown={(e) => handlePointerDown(e, node)}
                onPointerMove={handlePointerMove}
                onPointerUp={(e) => handlePointerUp(e, node)}
                style={{
                  left: node.x,
                  top: node.y,
                  width: NODE_SIZE.tactic.w,
                  transform: isSel ? "rotate(0deg)" : `rotate(${pinTilt(node.id)}deg)`,
                }}
                className={cn(
                  "jaal-board-node h-14 cursor-grab border border-jamber/45 bg-panel/95 px-2 py-1.5 transition-opacity transition-transform duration-200 active:cursor-grabbing",
                  isSel &&
                    "ring-1 ring-jamber shadow-[0_0_12px_rgba(255,170,69,0.25)]",
                  isDim && "opacity-30",
                )}
              >
                <div className="flex items-center gap-1">
                  <ShieldAlert className="size-3 shrink-0 text-jamber" />
                  <span className="truncate text-[10px] font-semibold text-jamber">
                    {meta?.name ?? ta.tactic}
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-[8px] uppercase tracking-widest text-jmuted/70">
                  {refNum
                    ? `supports MSG #${String(refNum).padStart(2, "0")}`
                    : "no source message"}
                </p>
              </div>
            );
          })}
        </div>

        {/* Selection action bar */}
        {selected && (
          <SelectionBar
            selected={selected}
            runtime={runtime}
            messageNumbers={messageNumbers}
            onOpenSource={onOpenSource}
            onOpenEvidence={onOpenEvidence}
            onClear={() => onSelect(null)}
          />
        )}
      </div>
    </div>
  );
}

function BoardToolbar({
  view,
  setView,
  onResetLayout,
  nodeCount,
  evidenceCount,
  tacticCount,
  crowded,
}: {
  view: "board" | "list";
  setView: (v: "board" | "list") => void;
  onResetLayout: () => void;
  nodeCount: number;
  evidenceCount: number;
  tacticCount: number;
  crowded?: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-jborder/60 bg-jsurface/80 px-2.5 py-1.5">
      <p className="jaal-label !text-jcyan">Evidence board</p>
      <span className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-widest text-jmuted/70">
        <span className="flex items-center gap-1">
          <span className="size-1.5 bg-jred/80" /> messages
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 bg-jcyan" /> evidence ({evidenceCount})
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 bg-jamber" /> tactics ({tacticCount})
        </span>
      </span>
      {crowded && (
        <span className="font-mono text-[8px] uppercase tracking-widest text-jamber">
          crowded — table view recommended
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <span className="mr-1 hidden font-mono text-[8px] uppercase tracking-widest text-jmuted/60 sm:inline">
          {nodeCount} nodes · drag to arrange
        </span>
        <button
          type="button"
          onClick={onResetLayout}
          title="Re-run automatic layout"
          className="flex size-6 items-center justify-center border border-jborder/70 text-jmuted transition-colors hover:border-jcyan/60 hover:text-jcyan"
        >
          <RotateCcw className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => setView(view === "board" ? "list" : "board")}
          title={view === "board" ? "Switch to table view" : "Switch to board view"}
          className="flex items-center gap-1 border border-jborder/70 px-1.5 py-1 font-mono text-[9px] uppercase tracking-wider text-jmuted transition-colors hover:border-jcyan/60 hover:text-jcyan"
        >
          {view === "board" ? (
            <>
              <List className="size-3" /> table
            </>
          ) : (
            <>
              <LayoutGrid className="size-3" /> board
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SelectionBar({
  selected,
  runtime,
  messageNumbers,
  onOpenSource,
  onOpenEvidence,
  onClear,
}: {
  selected: NonNullable<BoardSelection>;
  runtime: CaseRuntime;
  messageNumbers: Record<string, number>;
  onOpenSource: (messageId: string) => void;
  onOpenEvidence: (id: string) => void;
  onClear: () => void;
}) {
  let title = "";
  let sourceMessageId: string | null = null;
  let openEvidence: string | null = null;

  if (selected.kind === "message") {
    const m = runtime.messages.find((x) => x.id === selected.id);
    sourceMessageId = selected.id;
    title = `MSG #${String(messageNumbers[selected.id] ?? 0).padStart(2, "0")} — ${
      m?.author === "scammer" ? "suspect line" : "decoy line"
    } · linked records highlighted`;
  } else if (selected.kind === "evidence") {
    const e = runtime.evidence.find((x) => x.id === selected.id);
    sourceMessageId = e?.sourceMessageId ?? null;
    openEvidence = selected.id;
    title = `${e?.label ?? "Evidence"}: ${e?.value ?? ""} — ${
      sourceMessageId ? "source message highlighted" : "no source message linked"
    }`;
  } else {
    const t = runtime.tactics.find((x) => x.id === selected.id);
    sourceMessageId = t?.messageId ?? null;
    title = `${TACTIC_META[t?.tactic ?? "urgency"]?.name ?? "Tactic"} — supporting message${
      sourceMessageId ? " highlighted" : " not linked"
    }`;
  }

  return (
    <div className="pointer-events-auto absolute bottom-2 left-1/2 flex max-w-[92%] -translate-x-1/2 items-center gap-2 border border-jcyan/50 bg-panel/95 px-3 py-1.5 shadow-lg">
      <MapPin className="size-3 shrink-0 text-jcyan" />
      <span className="min-w-0 truncate font-mono text-[10px] text-jtext/90">
        {title}
      </span>
      <span className="ml-1 flex shrink-0 items-center gap-1.5">
        {sourceMessageId && (
          <button
            type="button"
            onClick={() => onOpenSource(sourceMessageId!)}
            className="flex items-center gap-1 border border-jcyan/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-jcyan transition-colors hover:bg-jcyan/10"
          >
            <MessageSquareQuote className="size-2.5" /> open source
          </button>
        )}
        {openEvidence && (
          <button
            type="button"
            onClick={() => onOpenEvidence(openEvidence)}
            className="flex items-center gap-1 border border-jgreen/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-jgreen transition-colors hover:bg-jgreen/10"
          >
            <Wallet className="size-2.5" /> detail
          </button>
        )}
        <button
          type="button"
          onClick={onClear}
          className="border border-jborder/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-jmuted transition-colors hover:text-jtext"
        >
          clear
        </button>
      </span>
    </div>
  );
}
