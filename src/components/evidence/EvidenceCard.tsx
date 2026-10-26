import { Chip, HASH_LABEL, HASH_STYLE } from "@/components/ui/panel";
import { copyToClipboard } from "@/utils/export";
import { shortHash } from "@/utils/hash";
import {
  indicatorAccent,
  integrityKey,
  reviewKey,
  statusDot,
  statusStyle,
} from "@/theme/status";
import type { EvidenceItem } from "@/types/evidence";
import { formatClock } from "@/utils/formatters";
import {
  Check,
  Copy,
  ExternalLink,
  Fingerprint,
  Link2,
  Mail,
  MessageSquareQuote,
  Phone,
  Receipt,
  ScrollText,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const EVIDENCE_ICON: Record<EvidenceItem["type"], LucideIcon> = {
  upi: Wallet,
  phone: Phone,
  url: Link2,
  email: Mail,
  payment_request: Receipt,
  scam_message: MessageSquareQuote,
  transcript: ScrollText,
  other: Fingerprint,
};

const dotStyle = (hashStatus: EvidenceItem["hashStatus"]) => ({
  background: statusDot("integrity", integrityKey(hashStatus)),
});

export function EvidenceCard({
  item,
  onOpen,
  onOpenSource,
  compact = false,
  sourceNumber,
}: {
  item: EvidenceItem;
  onOpen: () => void;
  onOpenSource?: () => void;
  compact?: boolean;
  /** Position of the source message, shown as MESSAGE #NN */
  sourceNumber?: number;
}) {
  const [copied, setCopied] = useState(false);
  const Icon = EVIDENCE_ICON[item.type] ?? Fingerprint;

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(item.value);
    if (ok) {
      setCopied(true);
      toast.success("Identifier copied", { duration: 1400 });
      setTimeout(() => setCopied(false), 1400);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-2 border border-jborder/60 bg-jsurface/70 px-2.5 py-2 text-left transition-colors hover:border-jcyan/50"
      >
        <Icon
          className="mt-0.5 size-3.5 shrink-0"
          style={{ color: indicatorAccent(item.type) }}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="jaal-label !text-[9px]">{item.label}</span>
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={dotStyle(item.hashStatus)}
            />
          </span>
          <span className="mt-0.5 block truncate font-mono text-[11px] text-jtext">
            {item.value}
          </span>
        </span>
      </button>
    );
  }

  return (
    <article
      onClick={onOpen}
      className="jaal-panel group cursor-pointer p-3 transition-colors hover:border-jcyan/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex size-6 shrink-0 items-center justify-center border border-jborder/60 bg-jsurface"
            style={{ color: indicatorAccent(item.type) }}
          >
            <Icon className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="jaal-label !tracking-[0.16em]">{item.label}</p>
            <p className="truncate font-mono text-xs text-jtext">{item.value}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={copy}
          title="Copy identifier"
          className="flex size-6 shrink-0 items-center justify-center border border-jborder/60 text-jmuted transition-colors hover:border-jcyan/60 hover:text-jcyan"
        >
          {copied ? <Check className="size-3 text-jgreen" /> : <Copy className="size-3" />}
        </button>
      </div>

      <p className="mt-2 line-clamp-2 border-l-2 border-jborder/70 pl-2 text-[10px] leading-relaxed text-jmuted">
        {sourceNumber !== undefined && (
          <span className="mr-1.5 font-mono text-[9px] uppercase tracking-wider text-jcyan/80">
            source: message #{String(sourceNumber).padStart(2, "0")}
          </span>
        )}
        {item.sourceMessageText || "No source message attached."}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Chip style={HASH_STYLE[item.hashStatus]}>
          {HASH_LABEL[item.hashStatus]}
        </Chip>
        {item.reviewStatus && (
          <Chip
            style={statusStyle(
              "review",
              reviewKey(item.reviewStatus) ?? "needsreview",
            )}
          >
            {item.reviewStatus === "needs_review"
              ? "needs review"
              : `analyst: ${item.reviewStatus}`}
          </Chip>
        )}
        <span className="font-mono text-[9px] uppercase tracking-widest text-jmuted/70">
          {formatClock(item.extractedAt)}
        </span>
        {item.tampered && (
          <span className="border border-jred/50 px-1.5 py-px font-mono text-[8px] uppercase tracking-widest text-jred">
            modified
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-jborder/50 pt-2">
        <span className="truncate font-mono text-[9px] text-jmuted/70">
          {item.hash ? `sha256 ${shortHash(item.hash, 8)}` : "hash not recorded"}
        </span>
        <span className="flex items-center gap-2">
          {onOpenSource && item.sourceMessageId && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSource();
              }}
              className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-jmuted transition-colors hover:text-jcyan"
            >
              <ExternalLink className="size-3" /> source
            </button>
          )}
          <span className="font-mono text-[9px] uppercase tracking-wider text-jcyan opacity-0 transition-opacity group-hover:opacity-100">
            open →
          </span>
        </span>
      </div>
    </article>
  );
}
