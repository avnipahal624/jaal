import { cn } from "@/lib/utils";
import type { InvestigationStatus } from "@/types/investigation";

export type InvestigationFilter = "all" | InvestigationStatus;

const OPTIONS: { id: InvestigationFilter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All" },
];

export function InvestigationFilters({
  value,
  onChange,
  counts,
}: {
  value: InvestigationFilter;
  onChange: (next: InvestigationFilter) => void;
  counts: Record<InvestigationFilter, number>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
            value === opt.id
              ? "border-jcyan/60 bg-jcyan/15 text-jcyan"
              : "border-jborder/70 bg-jsurface text-jmuted hover:border-jcyan/40 hover:text-jtext",
          )}
        >
          {opt.label}
          <span
            className={cn(
              "text-[9px]",
              value === opt.id ? "text-jcyan/70" : "text-jmuted/60",
            )}
          >
            {counts[opt.id] ?? 0}
          </span>
        </button>
      ))}
    </div>
  );
}
