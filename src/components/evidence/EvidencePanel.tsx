import { EVIDENCE_ICON } from "@/components/evidence/EvidenceCard";
import { Chip, Panel } from "@/components/ui/panel";
import { useEvidence } from "@/hooks/useEvidence";
import { cn } from "@/lib/utils";
import {
  indicatorAccent,
  integrityKey,
  reviewKey,
  statusDot,
  statusStyle,
} from "@/theme/status";
import type { EvidenceFilter, EvidenceItem } from "@/types/evidence";
import { Fingerprint, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { formatClock } from "@/utils/formatters";

const FILTERS: { id: EvidenceFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "upi", label: "UPI/pay" },
  { id: "phone", label: "Phones" },
  { id: "url", label: "Links" },
  { id: "email", label: "Emails" },
  { id: "verified", label: "Verified" },
  { id: "unverified", label: "Unverified" },
];

const HASH_TEXT: Record<EvidenceItem["hashStatus"], string> = {
  none: "unverified",
  generated: "hashed",
  verified: "verified",
  mismatch: "mismatch",
  tampered: "tamper sim",
};

/** Compact evidence row: type, value, source message, timestamp, integrity. */
function EvidenceRow({
  item,
  sourceNumber,
  onOpen,
}: {
  item: EvidenceItem;
  sourceNumber?: number;
  onOpen: () => void;
}) {
  const Icon = EVIDENCE_ICON[item.type] ?? Fingerprint;
  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onClick={onOpen}
      className={cn(
        "flex w-full items-start gap-2 border-l-2 bg-jsurface/40 px-2 py-1.5 text-left transition-colors hover:bg-white/[0.03]",
        item.hashStatus === "mismatch" || item.tampered
          ? "border-l-jred/70"
          : "border-l-jcyan/60",
      )}
    >
      <span
        className="mt-0.5 flex size-4 shrink-0 items-center justify-center border border-jborder/60"
        style={{ color: indicatorAccent(item.type) }}
      >
        <Icon className="size-2.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[11px] font-medium text-jtext">
            {item.value}
          </span>
          <span
            className="flex shrink-0 items-center gap-1 font-mono text-[8px] uppercase tracking-wider"
            style={{
              color: statusDot("integrity", integrityKey(item.hashStatus)),
            }}
          >
            <span
              className="size-1"
              style={{
                background: statusDot(
                  "integrity",
                  integrityKey(item.hashStatus),
                ),
              }}
              aria-hidden
            />
            {HASH_TEXT[item.hashStatus]}
          </span>
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-widest text-jmuted">
          <span className="text-jmuted/80">{item.label}</span>
          {sourceNumber !== undefined && (
            <span>
              · msg #
              {String(sourceNumber).padStart(2, "0")}
            </span>
          )}
          <span>· {formatClock(item.extractedAt)}</span>
          {item.reviewStatus && (
            <span
              className="border px-1 py-px"
              style={statusStyle(
                "review",
                reviewKey(item.reviewStatus) ?? "needsreview",
              )}
            >
              {item.reviewStatus === "needs_review"
                ? "review"
                : item.reviewStatus}
            </span>
          )}
        </span>
      </span>
    </motion.button>
  );
}

export function EvidencePanel({
  caseId,
  onOpenItem,
  footer,
  messageNumbers,
}: {
  caseId: string;
  onOpenItem: (id: string) => void;
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
      {/* Compact search + filters */}
      <div className="shrink-0 space-y-1.5 border-b border-jborder/50 p-2">
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

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          all.length === 0 ? (
            /* Useful empty state — explains what will appear here */
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
              <span className="flex size-8 items-center justify-center border border-jborder/60 bg-jsurface">
                <Fingerprint className="size-4 text-jmuted/60" />
              </span>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-jtext">
                No identifiers extracted
              </p>
              <p className="max-w-[260px] text-[11px] leading-relaxed text-jmuted">
                Evidence will appear here when JAAL identifies a phone number,
                UPI ID, URL, payment amount, or relevant statement in the
                conversation.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center">
              <p className="text-xs text-jmuted">Nothing matches this filter.</p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-jmuted/60">
                adjust the search or filters above
              </p>
            </div>
          )
        ) : (
          filtered.map((item) => (
            <EvidenceRow
              key={item.id}
              item={item}
              sourceNumber={
                item.sourceMessageId
                  ? messageNumbers?.[item.sourceMessageId]
                  : undefined
              }
              onOpen={() => onOpenItem(item.id)}
            />
          ))
        )}
      </div>

      {footer && (
        <div className="shrink-0 border-t border-jborder/50 p-2">{footer}</div>
      )}
    </Panel>
  );
}
