import { useJaal } from "@/state/JaalProvider";
import type { ActivityKind } from "@/types/investigation";
import { formatClock, relativeTime, truncate } from "@/utils/formatters";
import {
  ArrowRight,
  Fingerprint,
  Flag,
  FileSignature,
  Radio,
  ShieldCheck,
} from "lucide-react";

const KIND_ICON: Record<ActivityKind, typeof Radio> = {
  case_started: Radio,
  message: ArrowRight,
  identifier_extracted: Fingerprint,
  tactic_detected: ShieldCheck,
  hash_generated: ShieldCheck,
  stage_advanced: Flag,
  report_created: FileSignature,
  integrity_verified: ShieldCheck,
};

const KIND_COLOR: Record<ActivityKind, string> = {
  case_started: "text-jcyan border-jcyan/40",
  message: "text-jmuted border-jborder",
  identifier_extracted: "text-jcyan border-jcyan/40",
  tactic_detected: "text-jamber border-jamber/40",
  hash_generated: "text-jgreen border-jgreen/40",
  stage_advanced: "text-jamber border-jamber/40",
  report_created: "text-jteal border-jteal/40",
  integrity_verified: "text-jgreen border-jgreen/40",
};

export interface FeedEntry {
  id: string;
  caseId: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  timestamp: number;
}

/** Cross-case activity feed (dashboard) or single-case feed (workspace). */
export function ActivityFeed({
  entries,
  limit = 12,
  emptyText = "No activity recorded yet. Start a simulation to generate events.",
}: {
  entries: FeedEntry[];
  limit?: number;
  emptyText?: string;
}) {
  const shown = entries.slice(0, limit);
  if (shown.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-xs text-jmuted">{emptyText}</p>
    );
  }
  return (
    <ul className="divide-y divide-jborder/40">
      {shown.map((entry) => {
        const Icon = KIND_ICON[entry.kind] ?? Radio;
        return (
          <li key={entry.id} className="flex gap-3 px-3 py-2.5 density-py">
            <span
              className={`mt-0.5 flex size-6 shrink-0 items-center justify-center border ${KIND_COLOR[entry.kind] ?? "text-jmuted border-jborder"}`}
            >
              <Icon className="size-3" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-xs font-medium text-jtext">
                  {entry.title}
                </p>
                <span className="shrink-0 font-mono text-[9px] text-jmuted/70">
                  {formatClock(entry.timestamp)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-jmuted">
                {truncate(entry.detail, 90)}
              </p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-jcyan/70">
                {entry.caseId} · {relativeTime(entry.timestamp)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Gather activities across every case, newest first. */
export function useAllActivities(): FeedEntry[] {
  const { state } = useJaal();
  const all: FeedEntry[] = [];
  for (const rt of Object.values(state.sessions)) all.push(...rt.activities);
  return all.sort((a, b) => b.timestamp - a.timestamp);
}
