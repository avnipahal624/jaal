import { EvidenceCard } from "@/components/evidence/EvidenceCard";
import { Chip, Panel } from "@/components/ui/panel";
import { useEvidence } from "@/hooks/useEvidence";
import { cn } from "@/lib/utils";
import type { EvidenceFilter } from "@/types/evidence";
import { Fingerprint, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const FILTERS: { id: EvidenceFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "upi", label: "UPI/pay" },
  { id: "phone", label: "Phones" },
  { id: "url", label: "Links" },
  { id: "verified", label: "Verified" },
  { id: "unverified", label: "Unverified" },
];

export function EvidencePanel({
  caseId,
  onOpenItem,
  onOpenSource,
  footer,
  messageNumbers,
}: {
  caseId: string;
  onOpenItem: (id: string) => void;
  onOpenSource?: (messageId: string) => void;
  footer?: React.ReactNode;
  /** message id → MSG #NN */
  messageNumbers?: Record<string, number>;
}) {
  const { all, filtered, filter, setFilter, query, setQuery } = useEvidence(caseId);

  const verified = all.filter((e) => e.hashStatus === "verified").length;
  const mismatched = all.filter((e) => e.hashStatus === "mismatch").length;

  return (
    <Panel
      label={
        <div className="flex items-center gap-2">
          <Fingerprint className="size-3.5 text-jcyan" />
          <p className="jaal-label !text-jcyan">Evidence locker</p>
          <Chip tone="border-jcyan/40 bg-jcyan/10 text-jcyan">{all.length}</Chip>
        </div>
      }
      right={
        mismatched > 0 ? (
          <Chip tone="border-jred/50 bg-jred/10 text-jred">
            {mismatched} mismatch
          </Chip>
        ) : verified > 0 ? (
          <Chip tone="border-jgreen/50 bg-jgreen/10 text-jgreen">
            {verified} verified
          </Chip>
        ) : null
      }
      className="min-h-0 flex-1"
      bodyClassName="flex min-h-0 flex-col"
    >
      <div className="shrink-0 space-y-2 border-b border-jborder/50 p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-jmuted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search evidence…"
            className="h-7 border-jborder/70 bg-jsurface pl-8 font-mono text-[11px] text-jtext placeholder:text-jmuted/50 focus-visible:border-jcyan/70 focus-visible:ring-jcyan/40"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors",
                filter === f.id
                  ? "border-jcyan/60 bg-jcyan/15 text-jcyan"
                  : "border-jborder/60 text-jmuted hover:border-jcyan/40 hover:text-jtext",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-10 text-center">
            <Fingerprint className="size-5 text-jmuted/50" />
            <p className="text-xs text-jmuted">
              {all.length === 0
                ? "No evidence extracted yet."
                : "Nothing matches this filter."}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-widest text-jmuted/60">
              items appear as scammer messages arrive
            </p>
          </div>
        ) : (
          filtered.map((item) => (
            <EvidenceCard
              key={item.id}
              item={item}
              sourceNumber={
                item.sourceMessageId
                  ? messageNumbers?.[item.sourceMessageId]
                  : undefined
              }
              onOpen={() => onOpenItem(item.id)}
              onOpenSource={
                onOpenSource && item.sourceMessageId
                  ? () => onOpenSource(item.sourceMessageId!)
                  : undefined
              }
            />
          ))
        )}
      </div>

      {footer && <div className="shrink-0 border-t border-jborder/50 p-2">{footer}</div>}
    </Panel>
  );
}
