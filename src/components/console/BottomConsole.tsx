import { Chip } from "@/components/ui/panel";
import { useJaal } from "@/state/JaalProvider";
import { cn } from "@/lib/utils";
import type { ActivityKind, LogLevel } from "@/types/investigation";
import { copyToClipboard } from "@/utils/export";
import { formatClock } from "@/utils/formatters";
import { activityColor } from "@/theme/status";
import {
  Activity,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ClipboardCopy,
  Cpu,
  Eraser,
  Eye,
  EyeOff,
  Filter,
  Radio,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type TabId = "events" | "analysis" | "system";
/** collapsed: latest-event strip · default: ~150px · expanded: most of viewport */
type ConsoleState = "collapsed" | "default" | "expanded";

const LEVEL_STYLE: Record<LogLevel, string> = {
  info: "text-jcyan",
  warn: "text-jamber",
  success: "text-jgreen",
  error: "text-jred",
};

const ACTIVITY_ICON: Record<ActivityKind, LucideIcon> = {
  case_started: Radio,
  message: Activity,
  identifier_extracted: Activity,
  tactic_detected: Brain,
  hash_generated: Check,
  stage_advanced: Activity,
  report_created: Check,
  integrity_verified: Check,
  integrity_mismatch: ShieldAlert,
  evidence_reviewed: ClipboardCheck,
  correlation: ClipboardCheck,
  ai_analysis: Brain,
};



/** Split log lines into analysis vs system streams. */
function isAnalysisLog(message: string): boolean {
  return /Tactic|Identifier|hash|Integrity|mismatch|stage updated|Evidence|Report|analysis/i.test(
    message,
  );
}

/**
 * Bottom activity console — three states:
 *
 * collapsed — compact strip with the latest event only, workspace stays full.
 * default   — ~150px, tabs + latest four/five events.
 * expanded  — most of the remaining height, full chronological stream with
 *             pause (auto-scroll), copy, clear and filter controls.
 *
 * All content comes from actual application state (session activities + logs).
 */
export function BottomConsole({
  caseId,
  embedded = false,
}: {
  caseId: string;
  /** Rendered without collapse chrome (mobile Logs tab). */
  embedded?: boolean;
}) {
  const { state, clearLogs } = useJaal();
  const runtime = state.sessions[caseId];
  const [consoleState, setConsoleState] = useState<ConsoleState>(
    embedded ? "expanded" : "default",
  );
  const [tab, setTab] = useState<TabId>("events");
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filterText, setFilterText] = useState("");

  const bodyRef = useRef<HTMLDivElement | null>(null);

  const events = useMemo(
    () => [...(runtime?.activities ?? [])].sort((a, b) => a.timestamp - b.timestamp),
    [runtime?.activities],
  );
  const logs = runtime?.logs ?? [];
  const analysisLogs = logs.filter((l) => isAnalysisLog(l.message));
  const systemLogs = logs.filter((l) => !isAnalysisLog(l.message));

  const expanded = embedded || consoleState !== "collapsed";
  const isFullyExpanded = embedded || consoleState === "expanded";

  const matchesFilter = (text: string) =>
    filterText.trim() === "" ||
    text.toLowerCase().includes(filterText.trim().toLowerCase());

  const visibleEvents = (consoleState === "default" && !embedded
    ? events.slice(-5)
    : events
  ).filter((e) => matchesFilter(`${e.title} ${e.detail}`));
  const visibleAnalysis = analysisLogs.filter((l) => matchesFilter(l.message));
  const visibleSystem = systemLogs.filter((l) => matchesFilter(l.message));

  useEffect(() => {
    if (paused || !expanded) return;
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [events, logs, tab, paused, expanded]);

  if (!runtime) return null;

  const latestEvent = events[events.length - 1] ?? null;

  const copyLogs = async () => {
    const source =
      tab === "events"
        ? events
            .filter((e) => matchesFilter(`${e.title} ${e.detail}`))
            .map((e) => `[${formatClock(e.timestamp)}] ${e.title} — ${e.detail}`)
            .join("\n")
        : (tab === "analysis" ? visibleAnalysis : visibleSystem)
            .map((l) => `[${formatClock(l.timestamp)}] ${l.message}`)
            .join("\n");
    const ok = await copyToClipboard(source);
    if (ok) {
      setCopied(true);
      toast.success("Copied to clipboard", { duration: 1400 });
      setTimeout(() => setCopied(false), 1400);
    }
  };

  const header = (
    <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-jborder/60 bg-jsurface/90 px-2">
      {expanded ? (
        <div className="flex min-w-0 items-center gap-1">
          <Radio className="size-3 shrink-0 text-jcyan jaal-pulse" />
          {(
            [
              { id: "events" as const, label: "Events", icon: Activity },
              { id: "analysis" as const, label: "Analysis log", icon: Brain },
              { id: "system" as const, label: "System", icon: Cpu },
            ]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest transition-colors",
                tab === t.id
                  ? "border-jcyan/60 bg-jcyan/15 text-jcyan"
                  : "border-transparent text-jmuted hover:text-jtext",
              )}
            >
              <t.icon className="size-3" />
              {t.label}
              {t.id === "events" && (
                <span className="text-jcyan/70">({events.length})</span>
              )}
            </button>
          ))}
        </div>
      ) : (
        /* Collapsed strip — latest event only */
        <button
          type="button"
          onClick={() => setConsoleState("default")}
          className="flex min-w-0 items-center gap-2 text-left"
          title="Expand activity console"
        >
          <Radio className="size-3 shrink-0 text-jcyan" />
          {latestEvent ? (
            <span className="flex min-w-0 items-center gap-1.5 font-mono text-[10px]">
              <span className="shrink-0 text-jmuted/60">
                [{formatClock(latestEvent.timestamp)}]
              </span>
              <span
                className="shrink-0"
                style={{ color: activityColor(latestEvent.kind) }}
              >
                {latestEvent.title}
              </span>
              <span className="truncate text-jmuted">{latestEvent.detail}</span>
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-widest text-jmuted/60">
              activity console — no events yet
            </span>
          )}
        </button>
      )}

      <div className="flex shrink-0 items-center gap-1.5">
        <Chip tone="border-jborder/60 bg-jsurface text-jmuted" className="!px-1.5">
          {logs.length} lines
        </Chip>
        {!embedded && (
          <>
            {consoleState !== "collapsed" && (
              <button
                type="button"
                onClick={() =>
                  setConsoleState(consoleState === "expanded" ? "default" : "collapsed")
                }
                aria-label="Collapse console"
                title={
                  consoleState === "expanded"
                    ? "Shrink to default height"
                    : "Collapse to strip"
                }
                className="flex size-6 items-center justify-center border border-jborder/70 text-jmuted transition-colors hover:border-jcyan/50 hover:text-jcyan"
              >
                <ChevronDown className="size-3.5" />
              </button>
            )}
            {consoleState !== "expanded" && (
              <button
                type="button"
                onClick={() =>
                  setConsoleState(consoleState === "collapsed" ? "default" : "expanded")
                }
                aria-label="Expand console"
                title={
                  consoleState === "collapsed"
                    ? "Show recent events"
                    : "Expand to full stream"
                }
                className="flex size-6 items-center justify-center border border-jborder/70 text-jmuted transition-colors hover:border-jcyan/50 hover:text-jcyan"
              >
                <ChevronUp className="size-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  const controls = isFullyExpanded && (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-jborder/50 px-2 py-1">
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
        title="Copy"
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
      <label className="ml-auto flex min-w-0 items-center gap-1.5">
        <Filter className="size-3 shrink-0 text-jmuted" />
        <input
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filter…"
          className="h-5 w-28 min-w-0 border border-jborder/60 bg-jsurface px-1.5 font-mono text-[10px] text-jtext placeholder:text-jmuted/50 focus-visible:border-jcyan/60 focus-visible:outline-none sm:w-40"
        />
      </label>
      <span className="hidden shrink-0 font-mono text-[8px] uppercase tracking-widest text-jmuted/60 lg:inline">
        live from application state
      </span>
    </div>
  );

  return (
    <section
      className={cn(
        "jaal-panel flex shrink-0 flex-col border-x-0 border-b-0",
        embedded
          ? "h-full"
          : consoleState === "collapsed"
            ? "h-8"
            : consoleState === "default"
              ? "h-[150px]"
              : "h-[42vh] min-h-[260px]",
        !embedded && "transition-[height] duration-200",
      )}
    >
      {header}
      {expanded && (
        <div className="flex min-h-0 flex-1 flex-col">
          {controls}
          <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5">
            {tab === "events" &&
              (visibleEvents.length === 0 ? (
                <p className="py-4 text-center font-mono text-[11px] text-jmuted">
                  {events.length === 0
                    ? "No investigation events yet."
                    : "No events match the filter."}
                </p>
              ) : (
                visibleEvents.map((e) => {
                  const Icon = ACTIVITY_ICON[e.kind] ?? Activity;
                  return (
                    <p
                      key={e.id}
                      className="flex gap-2 font-mono text-[11px] leading-relaxed"
                    >
                      <span className="shrink-0 text-jmuted/60">
                        [{formatClock(e.timestamp)}]
                      </span>
                      <Icon
                        className="mt-0.5 size-3 shrink-0"
                        style={{ color: activityColor(e.kind) }}
                      />
                      <span style={{ color: activityColor(e.kind) }}>
                        {e.title}
                      </span>
                      <span className="truncate text-jmuted">{e.detail}</span>
                    </p>
                  );
                })
              ))}

            {tab === "analysis" &&
              (visibleAnalysis.length === 0 ? (
                <p className="py-4 text-center font-mono text-[11px] text-jmuted">
                  {analysisLogs.length === 0
                    ? "No analysis events yet."
                    : "No analysis lines match the filter."}
                </p>
              ) : (
                visibleAnalysis.map((l) => (
                  <p key={l.id} className="flex gap-2 font-mono text-[11px] leading-relaxed">
                    <span className="shrink-0 text-jmuted/60">[{formatClock(l.timestamp)}]</span>
                    <span className={LEVEL_STYLE[l.level]}>{l.message}</span>
                  </p>
                ))
              ))}

            {tab === "system" &&
              (visibleSystem.length === 0 ? (
                <p className="py-4 text-center font-mono text-[11px] text-jmuted">
                  {systemLogs.length === 0
                    ? "No system activity yet."
                    : "No system lines match the filter."}
                </p>
              ) : (
                visibleSystem.map((l) => (
                  <p key={l.id} className="flex gap-2 font-mono text-[11px] leading-relaxed">
                    <span className="shrink-0 text-jmuted/60">[{formatClock(l.timestamp)}]</span>
                    <span className={LEVEL_STYLE[l.level]}>{l.message}</span>
                  </p>
                ))
              ))}

            {!paused && (
              <span className="font-mono text-[11px] text-jcyan jaal-caret">▌</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
