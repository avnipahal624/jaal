import { cn } from "@/lib/utils";
import { statusStyle } from "@/theme/status";
import type {
  CaseRunStatus,
  InvestigationStatus,
  KillChainStageId,
  StageStatus,
} from "@/types/investigation";
import type { HashStatus } from "@/types/evidence";
import type { CSSProperties, ReactNode } from "react";

type StatusStyle = CSSProperties;

/** Bordered investigation panel with HUD corner brackets and a mono label. */
export function Panel({
  label,
  right,
  children,
  className,
  bodyClassName,
}: {
  label?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "jaal-panel jaal-hud relative flex min-h-0 flex-col",
        className,
      )}
    >
      {label !== undefined && (
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-jborder/60 px-3 py-2">
          <div className="min-w-0">{label}</div>
          {right}
        </header>
      )}
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

export const STAGE_TONE: Record<KillChainStageId, string> = {
  contact: "text-jteal",
  authority: "text-jcyan",
  fear: "text-jamber",
  payment: "text-jamber",
  exploit: "text-jred",
};

/* Status chip styles — all colors come from the shared status config
 * (src/theme/status.ts) via CSS variables, applied as inline styles so they
 * work without Tailwind seeing runtime-composed class names. */

export const STAGE_STATUS_STYLE: Record<StageStatus, StatusStyle> = {
  pending: statusStyle("stage", "pending"),
  active: statusStyle("stage", "active"),
  detected: statusStyle("stage", "detected"),
  completed: statusStyle("stage", "completed"),
};

export const INVESTIGATION_STATUS_STYLE: Record<InvestigationStatus, StatusStyle> = {
  active: statusStyle("inv", "active"),
  completed: statusStyle("inv", "completed"),
  archived: statusStyle("inv", "archived"),
};

export const RUN_STATUS_STYLE: Record<CaseRunStatus, StatusStyle> = {
  running: statusStyle("run", "active"),
  paused: statusStyle("run", "paused"),
  completed: statusStyle("run", "completed"),
};

export const HASH_STYLE: Record<HashStatus, StatusStyle> = {
  none: statusStyle("integrity", "nothashed"),
  generated: statusStyle("integrity", "generated"),
  verified: statusStyle("integrity", "verified"),
  mismatch: statusStyle("integrity", "mismatch"),
};

export const HASH_LABEL: Record<HashStatus, string> = {
  none: "Unverified lead",
  generated: "Hash generated",
  verified: "Integrity verified",
  mismatch: "Hash mismatch",
};

export function Chip({
  tone,
  style,
  children,
  className,
  pulse,
}: {
  /** Tailwind tone classes (plain chips only — status colors use `style`). */
  tone?: string;
  /** Inline styles from the shared status config (statusStyle/paperStyle). */
  style?: CSSProperties;
  children: ReactNode;
  className?: string;
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        tone,
        className,
      )}
      style={style}
    >
      {pulse && <span className="size-1.5 shrink-0 bg-current jaal-pulse" />}
      {children}
    </span>
  );
}
