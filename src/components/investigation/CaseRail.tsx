import { Chip, Panel } from "@/components/ui/panel";
import { KillChainTimeline } from "@/components/investigation/KillChainTimeline";
import { cn } from "@/lib/utils";
import type {
  ActivityEvent,
  ActivityKind,
  CaseRuntime,
  Investigation,
} from "@/types/investigation";
import { formatClock } from "@/utils/formatters";
import {
  Activity,
  Brain,
  Check,
  Fingerprint,
  Flag,
  MessageSquare,
  Radio,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

const ACTIVITY_ICON: Record<ActivityKind, LucideIcon> = {
  case_started: Radio,
  message: MessageSquare,
  identifier_extracted: Fingerprint,
  tactic_detected: Brain,
  hash_generated: Check,
  stage_advanced: Activity,
  report_created: Check,
  integrity_verified: ShieldCheck,
  integrity_mismatch: ShieldAlert,
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
  integrity_mismatch: "text-jred",
};

/** Compact stat row used by the clue summary. */
function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-1">
      <span className="font-mono text-[9px] uppercase tracking-widest text-jmuted">
        {label}
      </span>
      <span className={cn("font-mono text-[11px] font-semibold", tone ?? "text-jtext")}>
        {value}
      </span>
    </div>
  );
}

/**
 * LEFT CASE RAIL — briefing, investigation stages, discovered clues and a
 * recent-activity digest. Everything derives from live case state; nothing is
 * prewritten.
 */
export function CaseRail({
  investigation,
  runtime,
}: {
  investigation: Investigation;
  runtime: CaseRuntime;
}) {
  const messages = runtime.messages.filter((m) => m.author !== "system");
  const suspect = messages.filter((m) => m.author === "scammer").length;
  const hashed = runtime.evidence.filter((e) => e.hash).length;
  const verified = runtime.evidence.filter((e) => e.hashStatus === "verified").length;
  const mismatched = runtime.evidence.filter((e) => e.hashStatus === "mismatch").length;
  const reviewed = runtime.evidence.filter((e) => e.reviewStatus).length;
  const recent: ActivityEvent[] = [...runtime.activities]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 6);
  const activeStage = runtime.stages.find((s) => s.status === "active");

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-2">
      {/* Briefing */}
      <Panel
        label={
          <div className="flex items-center gap-2">
            <Flag className="size-3 text-jamber" />
            <p className="jaal-label !text-jamber">Case briefing</p>
          </div>
        }
        className="shrink-0"
      >
        <div className="space-y-2 p-2.5">
          <p className="text-[11px] leading-relaxed text-jtext/90">
            {investigation.description}
          </p>
          <div className="flex flex-wrap gap-1">
            <Chip tone="border-jborder/60 bg-jsurface text-jmuted">
              {investigation.category}
            </Chip>
            <Chip tone="border-jcyan/40 bg-jcyan/10 text-jcyan">
              {investigation.source === "simulation"
                ? "scripted simulation"
                : `${investigation.source} import`}
            </Chip>
            <Chip
              tone={
                runtime.status === "running"
                  ? "border-jred/50 bg-jred/10 text-jred"
                  : runtime.status === "paused"
                    ? "border-jamber/50 bg-jamber/10 text-jamber"
                    : "border-jgreen/50 bg-jgreen/10 text-jgreen"
              }
              pulse={runtime.status === "running"}
            >
              {runtime.status}
            </Chip>
          </div>
          <div className="border-t border-jborder/50 pt-1.5">
            <Stat
              label="active stage"
              value={activeStage ? activeStage.label : "not started"}
              tone={activeStage ? "text-jamber" : "text-jmuted"}
            />
            <Stat
              label="stages detected"
              value={`${runtime.stages.filter((s) => s.status !== "pending").length}/${runtime.stages.length}`}
              tone="text-jteal"
            />
          </div>
        </div>
      </Panel>

      {/* Stage tracker */}
      <Panel
        label={<p className="jaal-label">Scam kill-chain</p>}
        className="shrink-0"
      >
        <KillChainTimeline
          stages={runtime.stages}
          messages={runtime.messages}
          tactics={runtime.tactics}
        />
      </Panel>

      {/* Discovered clues */}
      <Panel
        label={
          <div className="flex items-center gap-2">
            <Fingerprint className="size-3 text-jcyan" />
            <p className="jaal-label">Discovered clues</p>
          </div>
        }
        className="shrink-0"
      >
        <div className="divide-y divide-jborder/30 py-0.5">
          <Stat label="messages" value={messages.length} />
          <Stat label="suspect lines" value={suspect} tone="text-jred/90" />
          <Stat
            label="identifiers"
            value={runtime.evidence.length}
            tone="text-jcyan"
          />
          <Stat
            label="tactic hits"
            value={runtime.tactics.length}
            tone="text-jamber"
          />
          <Stat label="hashes" value={hashed} tone="text-jteal" />
          <Stat
            label="verified / mismatch"
            value={`${verified} / ${mismatched}`}
            tone={mismatched > 0 ? "text-jred" : verified > 0 ? "text-jgreen" : "text-jmuted"}
          />
          <Stat
            label="analyst reviewed"
            value={reviewed}
            tone={reviewed > 0 ? "text-jgreen" : "text-jmuted"}
          />
        </div>
      </Panel>

      {/* Activity digest */}
      <Panel
        label={
          <p className="jaal-label">Activity digest</p>
        }
        right={
          <span className="font-mono text-[8px] uppercase tracking-widest text-jmuted/60">
            latest {recent.length}
          </span>
        }
        className="shrink-0"
      >
        <div className="space-y-1 p-2">
          {recent.length === 0 ? (
            <p className="py-2 text-center font-mono text-[10px] text-jmuted">
              No events yet.
            </p>
          ) : (
            recent.map((e) => {
              const Icon = ACTIVITY_ICON[e.kind] ?? Activity;
              return (
                <p key={e.id} className="flex items-start gap-1.5 font-mono text-[9px] leading-relaxed">
                  <span className="shrink-0 text-jmuted/50">
                    {formatClock(e.timestamp)}
                  </span>
                  <Icon
                    className={cn(
                      "mt-0.5 size-2.5 shrink-0",
                      ACTIVITY_COLOR[e.kind] ?? "text-jmuted",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-jtext/80">
                    {e.title}
                  </span>
                </p>
              );
            })
          )}
        </div>
      </Panel>
    </div>
  );
}
