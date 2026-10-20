import { cn } from "@/lib/utils";
import type {
  CaseRunStatus,
  InvestigationStatus,
  KillChainStageId,
  StageStatus,
} from "@/types/investigation";
import type { HashStatus } from "@/types/evidence";
import type { ReactNode } from "react";

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

export const STAGE_STATUS_TONE: Record<StageStatus, string> = {
  pending: "border-jborder/60 text-jmuted/60",
  active: "border-jamber/60 bg-jamber/10 text-jamber",
  detected: "border-jcyan/60 bg-jcyan/10 text-jcyan",
  completed: "border-jteal/50 bg-jteal/10 text-jteal",
};

export const INVESTIGATION_STATUS_TONE: Record<InvestigationStatus, string> = {
  active: "border-jcyan/50 bg-jcyan/10 text-jcyan",
  completed: "border-jgreen/50 bg-jgreen/10 text-jgreen",
  archived: "border-jborder/70 bg-jsurface text-jmuted",
};

export const RUN_STATUS_TONE: Record<CaseRunStatus, string> = {
  running: "border-jcyan/50 bg-jcyan/10 text-jcyan",
  paused: "border-jamber/50 bg-jamber/10 text-jamber",
  completed: "border-jgreen/50 bg-jgreen/10 text-jgreen",
};

export const HASH_TONE: Record<HashStatus, string> = {
  none: "border-jborder/70 bg-jsurface text-jmuted",
  generated: "border-jcyan/50 bg-jcyan/10 text-jcyan",
  verified: "border-jgreen/50 bg-jgreen/10 text-jgreen",
  mismatch: "border-jred/50 bg-jred/10 text-jred",
};

export const HASH_LABEL: Record<HashStatus, string> = {
  none: "Unverified lead",
  generated: "Hash generated",
  verified: "Integrity verified",
  mismatch: "Hash mismatch",
};

export function Chip({
  tone,
  children,
  className,
  pulse,
}: {
  tone: string;
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
    >
      {pulse && <span className="size-1.5 shrink-0 bg-current jaal-pulse" />}
      {children}
    </span>
  );
}
