import { Chip } from "@/components/ui/panel";
import { useJaal } from "@/state/JaalProvider";
import { cn } from "@/lib/utils";
import type { ActivityKind, LogLevel } from "@/types/investigation";
import { copyToClipboard } from "@/utils/export";
import { formatClock } from "@/utils/formatters";
import {
  Activity,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Cpu,
  Eraser,
  Eye,
  EyeOff,
  Radio,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type TabId = "events" | "analysis" | "system";

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
};

const ACTIVITY_COLOR: Record<ActivityKind, string> = {
  case_started: "text-jcyan",
  message: "text-jtext/80",
  identifier_extracted: "text-jcyan",
  tactic_detected: "text-jamber",
  hash_generated: "text-jgreen",
  stage_advanced: "text-jamber",
  report_created: "text-jteal",
  integrity_verified: "text-jgreen",
};

/** Split log lines into analysis vs system streams. */
function isAnalysisLog(message: string): boolean {
  return /Tactic|Identifier|hash|Integrity|mismatch|stage updated|Evidence|Report|analysis/i.test(
    message,
  );
}

/**
 * Bottom activity console.
 *
 * EVENTS — chronological investigation events from application state.
 * ANALYSIS LOG — tactic detection, identifier extraction, hashing events.
 * SYSTEM — backend + simulation activity.
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
  const [expanded, setExpanded] = useState(!embedded);
  const [tab, setTab] = useState<TabId>("events");
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);

  const bodyRef = useRef<HTMLDivElement | null>(null);

  const events = useMemo(
    () => [...(runtime?.activities ?? [])].sort((a, b) => a.timestamp - b.timestamp),
    [runtime?.activities],
  );
  const logs = runtime?.logs ?? [];
  const analysisLogs = logs.filter((l) => isAnalysisLog(l.message));
  const systemLogs = logs.filter((l) => !isAnalysisLog(l.message));

  useEffect(() => {
    if (paused || !expanded) return;
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [events, logs, tab, paused, expanded]);

  if (!runtime) return null;

  const copyLogs = async () => {
    const source =
      tab === "events"
        ? events
            .map((e) => `[${formatClock(e.timestamp)}] ${e.title} — ${e.detail}`)
            .join("\n")
        : (tab === "analysis" ? analysisLogs : systemLogs)
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
    <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-jborder/60 bg-jsurface/90 px-2">
      <div className="flex items-center gap-1">
        <Radio className="size-3 text-jcyan jaal-pulse" />
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
            {t.label}
            {t.id === "events" && (
              <span className="text-jcyan/70">({events.length})</span>
            )}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Chip tone="border-jborder/60 bg-jsurface text-jmuted" className="!px-1.5">
          {logs.length} lines
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

  const controls = (
    <div className="flex items-center gap-1.5 border-b border-jborder/50 px-3 py-1">
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
      <span className="ml-auto font-mono text-[8px] uppercase tracking-widest text-jmuted/60">
        live from application state
      </span>
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
      <div className={cn("min-h-0 flex-1", expanded ? "flex flex-col" : "hidden")}>
        {controls}
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5">
          {tab === "events" &&
            (events.length === 0 ? (
              <p className="py-6 text-center font-mono text-[11px] text-jmuted">
                No investigation events yet.
              </p>
            ) : (
              events.map((e) => {
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
                      className={cn(
                        "mt-0.5 size-3 shrink-0",
                        ACTIVITY_COLOR[e.kind] ?? "text-jmuted",
                      )}
                    />
                    <span className={ACTIVITY_COLOR[e.kind] ?? "text-jtext/80"}>
                      {e.title}
                    </span>
                    <span className="truncate text-jmuted">{e.detail}</span>
                  </p>
                );
              })
            ))}

          {tab === "analysis" &&
            (analysisLogs.length === 0 ? (
              <p className="py-6 text-center font-mono text-[11px] text-jmuted">
                No analysis events yet.
              </p>
            ) : (
              analysisLogs.map((l) => (
                <p key={l.id} className="flex gap-2 font-mono text-[11px] leading-relaxed">
                  <span className="shrink-0 text-jmuted/60">[{formatClock(l.timestamp)}]</span>
                  <span className={LEVEL_STYLE[l.level]}>{l.message}</span>
                </p>
              ))
            ))}

          {tab === "system" &&
            (systemLogs.length === 0 ? (
              <p className="py-6 text-center font-mono text-[11px] text-jmuted">
                No system activity yet.
              </p>
            ) : (
              systemLogs.map((l) => (
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
    </section>
  );
}
