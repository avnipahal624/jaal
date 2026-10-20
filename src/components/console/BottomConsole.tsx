import { Chip } from "@/components/ui/panel";
import { useJaal } from "@/state/JaalProvider";
import { cn } from "@/lib/utils";
import type { EvidenceItem } from "@/types/evidence";
import type { LogLevel } from "@/types/investigation";
import { copyToClipboard } from "@/utils/export";
import { formatClock } from "@/utils/formatters";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Eraser,
  Eye,
  EyeOff,
  Radio,
  ScanLine,
  TerminalSquare,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type TabId = "osint" | "logs" | "console";

const LEVEL_STYLE: Record<LogLevel, string> = {
  info: "text-jcyan",
  warn: "text-jamber",
  success: "text-jgreen",
  error: "text-jred",
};

const LEVEL_FILTERS: { id: LogLevel | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "info", label: "Info" },
  { id: "warn", label: "Warn" },
  { id: "success", label: "OK" },
  { id: "error", label: "Error" },
];

/** Build OSINT lines from the case's actual local data. */
function buildScanLines(evidence: EvidenceItem[], tacticCount: number): string[] {
  const lines: string[] = [
    `Local synthetic dataset mounted · ${evidence.length} evidence artefacts indexed`,
    `Extracting suspicious identifiers from stored messages… ${evidence.length} found`,
    `Matching scam tactic patterns against local rule set… ${tacticCount} matched`,
  ];
  for (const item of evidence) {
    if (item.type === "url") {
      lines.push(
        `URL format check: ${item.value} — parse ok · reserved/synthetic host check applies`,
      );
    } else if (item.type === "upi") {
      lines.push(
        `UPI handle format: ${item.value} — pattern valid · ownership NOT queried`,
      );
    } else if (item.type === "phone") {
      lines.push(
        `Phone format: ${item.value} — numbering-plan shape ok · no carrier lookup performed`,
      );
    } else if (item.type === "payment_request") {
      lines.push(
        `Payment demand recorded: ${item.value} — flagged as suspicious payment request`,
      );
    } else if (item.type === "transcript") {
      lines.push(`Transcript digest computed for ${item.value}`);
    } else {
      lines.push(`Reference pattern indexed: ${item.value}`);
    }
  }
  lines.push(
    "Indicator lookup: local demo dataset only — no external sources queried, no accounts traced",
  );
  lines.push("Pattern scan complete. Results are simulation-only.");
  return lines;
}

export function BottomConsole({
  caseId,
  embedded = false,
}: {
  caseId: string;
  /** Rendered without collapse chrome (e.g. inside a mobile tab). */
  embedded?: boolean;
}) {
  const { state, clearLogs } = useJaal();
  const runtime = state.sessions[caseId];
  const [expanded, setExpanded] = useState(!embedded);
  const [tab, setTab] = useState<TabId>("logs");
  const [paused, setPaused] = useState(false);
  const [levelFilter, setLevelFilter] = useState<LogLevel | "all">("all");
  const [scanIndex, setScanIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const logRef = useRef<HTMLDivElement | null>(null);
  const consoleRef = useRef<HTMLDivElement | null>(null);

  const logs = useMemo(
    () =>
      levelFilter === "all"
        ? (runtime?.logs ?? [])
        : (runtime?.logs ?? []).filter((l) => l.level === levelFilter),
    [runtime?.logs, levelFilter],
  );

  const scanLines = useMemo(
    () => buildScanLines(runtime?.evidence ?? [], runtime?.tactics.length ?? 0),
    [runtime?.evidence, runtime?.tactics.length],
  );

  // OSINT staged scan reveal
  useEffect(() => {
    if (tab !== "osint" || !expanded) return;
    setScanIndex(0);
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setScanIndex(i);
      if (i >= scanLines.length) window.clearInterval(timer);
    }, 240);
    return () => window.clearInterval(timer);
  }, [tab, expanded, scanLines.length]);

  // Auto-scroll unless paused
  useEffect(() => {
    if (paused || !expanded) return;
    if (tab === "logs" && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
    if (tab === "console" && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, tab, paused, expanded]);

  const copyLogs = async () => {
    const text = (runtime?.logs ?? [])
      .map((l) => `[${formatClock(l.timestamp)}] ${l.message}`)
      .join("\n");
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      toast.success("Logs copied", { duration: 1400 });
      setTimeout(() => setCopied(false), 1400);
    }
  };

  if (!runtime) return null;

  const header = (
    <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-jborder/60 bg-jsurface/90 px-2">
      <div className="flex items-center gap-1">
        <Radio className="size-3 text-jcyan jaal-pulse" />
        {(
          [
            { id: "osint" as const, label: "OSINT / pattern scan", icon: ScanLine },
            { id: "logs" as const, label: "Logs", icon: Eye },
            { id: "console" as const, label: "Live console", icon: TerminalSquare },
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              if (!embedded) setExpanded(true);
            }}
            className={cn(
              "flex items-center gap-1.5 border px-2 py-1 font-mono text-[9px] uppercase tracking-widest transition-colors",
              tab === t.id
                ? "border-jcyan/60 bg-jcyan/15 text-jcyan"
                : "border-transparent text-jmuted hover:text-jtext",
            )}
          >
            <t.icon className="size-3" />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label.split(" ")[0]}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Chip tone="border-jborder/60 bg-jsurface text-jmuted" className="!px-1.5">
          {runtime.logs.length} lines
        </Chip>
        {!embedded && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? "Collapse console" : "Expand console"}
            className="flex size-6 items-center justify-center border border-jborder/70 text-jmuted transition-colors hover:border-jcyan/50 hover:text-jcyan"
          >
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
          </button>
        )}
      </div>
    </div>
  );

  const body = (
    <div className={cn("min-h-0 flex-1", expanded ? "" : "hidden")}>
      {/* ---------------- OSINT ---------------- */}
      {tab === "osint" && (
        <div className="flex h-full flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-jborder/50 px-3 py-1.5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-jmuted">
              simulated scan · local synthetic dataset
            </p>
            <button
              type="button"
              onClick={() => setScanIndex(0)}
              className="border border-jcyan/50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-jcyan transition-colors hover:bg-jcyan/15"
            >
              Re-run scan
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
            {scanLines.slice(0, scanIndex).map((line, i) => (
              <p key={i} className="flex gap-2">
                <span className="shrink-0 text-jcyan/60">
                  [{String(i + 1).padStart(2, "0")}]
                </span>
                <span className={line.includes("NOT queried") || line.includes("no external") ? "text-jamber" : "text-jtext/85"}>
                  {line}
                </span>
              </p>
            ))}
            {scanIndex < scanLines.length && (
              <p className="text-jcyan">
                scanning<span className="jaal-caret">▌</span>
              </p>
            )}
            {scanIndex >= scanLines.length && (
              <p className="mt-1 text-jgreen">scan complete ✓</p>
            )}
          </div>
        </div>
      )}

      {/* ---------------- LOGS ---------------- */}
      {tab === "logs" && (
        <div className="flex h-full flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-jborder/50 px-3 py-1.5">
            <div className="flex items-center gap-1">
              {LEVEL_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setLevelFilter(f.id)}
                  className={cn(
                    "border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors",
                    levelFilter === f.id
                      ? "border-jcyan/60 bg-jcyan/15 text-jcyan"
                      : "border-jborder/60 text-jmuted hover:text-jtext",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className={cn(
                  "flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors",
                  paused
                    ? "border-jamber/60 bg-jamber/10 text-jamber"
                    : "border-jborder/60 text-jmuted hover:text-jtext",
                )}
                title="Pause auto-scroll"
              >
                {paused ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                {paused ? "resume" : "pause"}
              </button>
              <button
                type="button"
                onClick={copyLogs}
                className="flex items-center gap-1 border border-jborder/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-jmuted transition-colors hover:border-jcyan/50 hover:text-jcyan"
                title="Copy logs"
              >
                {copied ? <Check className="size-3 text-jgreen" /> : <ClipboardCopy className="size-3" />}
                copy
              </button>
              <button
                type="button"
                onClick={() => clearLogs(caseId)}
                className="flex items-center gap-1 border border-jborder/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-jmuted transition-colors hover:border-jred/50 hover:text-jred"
                title="Clear logs"
              >
                <Eraser className="size-3" /> clear
              </button>
            </div>
          </div>
          <div ref={logRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5">
            {logs.length === 0 ? (
              <p className="py-6 text-center font-mono text-[11px] text-jmuted">
                No log entries for this filter.
              </p>
            ) : (
              logs.map((l) => (
                <p key={l.id} className="flex gap-2 font-mono text-[11px] leading-relaxed">
                  <span className="shrink-0 text-jmuted/60">[{formatClock(l.timestamp)}]</span>
                  <span className={LEVEL_STYLE[l.level]}>{l.message}</span>
                </p>
              ))
            )}
            {!paused && <span className="text-jcyan jaal-caret">▌</span>}
          </div>
        </div>
      )}

      {/* ---------------- LIVE CONSOLE ---------------- */}
      {tab === "console" && (
        <div className="flex h-full flex-col">
          <div className="border-b border-jborder/50 px-3 py-1.5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-jmuted">
              jaal event stream · frontend state events (no shell execution)
            </p>
          </div>
          <div
            ref={consoleRef}
            className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5 font-mono text-[11px] leading-relaxed"
          >
            <p className="text-jmuted/60">
              jaal@{caseId.toLowerCase()}:~$ attach --events
            </p>
            {logs.map((l) => (
              <p key={l.id} className="flex gap-2">
                <span
                  className={cn(
                    "shrink-0",
                    l.level === "error"
                      ? "text-jred"
                      : l.level === "warn"
                        ? "text-jamber"
                        : l.level === "success"
                          ? "text-jgreen"
                          : "text-jcyan",
                  )}
                >
                  {l.level === "error"
                    ? "✗"
                    : l.level === "warn"
                      ? "!"
                      : l.level === "success"
                        ? "✓"
                        : "›"}
                </span>
                <span
                  className={cn(
                    l.level === "error"
                      ? "text-jred"
                      : l.level === "warn"
                        ? "text-jamber"
                        : l.level === "success"
                          ? "text-jgreen"
                          : "text-jtext/80",
                  )}
                >
                  {l.message}
                </span>
              </p>
            ))}
            <p className="text-jcyan">
              › <span className="jaal-caret">▌</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <section
      className={cn(
        "jaal-panel flex shrink-0 flex-col border-x-0 border-b-0",
        embedded ? "h-full" : expanded ? "h-56" : "h-9",
        !embedded && "transition-[height] duration-200",
      )}
    >
      {header}
      {body}
    </section>
  );
}
