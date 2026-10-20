import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Compact statistic tile with a mono label and small accent bar. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "text-jcyan",
  bar = "bg-jcyan",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: string;
  bar?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "jaal-panel relative overflow-hidden p-3.5 transition-colors hover:border-jcyan/40",
        className,
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-px", bar)} />
      <div className="flex items-start justify-between gap-2">
        <p className="jaal-label">{label}</p>
        {icon && <span className={cn("shrink-0", tone)}>{icon}</span>}
      </div>
      <p className={cn("mt-2 font-mono text-2xl font-semibold leading-none", tone)}>
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[10px] text-jmuted">{hint}</p>}
    </div>
  );
}
