import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Chip, HASH_LABEL, HASH_STYLE } from "@/components/ui/panel";
import { EVIDENCE_ICON } from "./EvidenceCard";
import { useJaal } from "@/state/JaalProvider";
import type { EvidenceItem } from "@/types/evidence";
import { formatDateTime, maskValue } from "@/utils/formatters";
import { copyToClipboard } from "@/utils/export";
import { sha256Hex, shortHash } from "@/utils/hash";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { integrityKey, statusStyle } from "@/theme/status";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Eye,
  EyeOff,
  ExternalLink,
  FileWarning,
  Fingerprint,
  History,
  Loader2,
  Maximize2,
  Minimize2,
  Pencil,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Evidence detail drawer.
 *
 * Integrity semantics are stated explicitly: a hash proves content has not
 * changed since recording — nothing more.
 */
export function EvidenceDrawer({
  item,
  caseId,
  onOpenChange,
  onOpenSource,
  open,
}: {
  item: EvidenceItem | null;
  caseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSource?: () => void;
}) {
  const {
    generateHash,
    verifyEvidence,
    rebaselineEvidence,
    setEvidenceContent,
    setEvidenceNotes,
    reviewEvidence,
  } = useJaal();
  const [busy, setBusy] = useState<null | "hash" | "verify" | "rebaseline">(null);
  // Extracted values are masked by default; reveal is an explicit action.
  const [revealed, setRevealed] = useState(false);
  const [rebaselineOpen, setRebaselineOpen] = useState(false);
  const [rebaselineReason, setRebaselineReason] = useState("");
  const [result, setResult] = useState<
    null | "match" | "mismatch" | "generated" | "error"
  >(null);
  // Baseline-vs-current digests, populated only by a real verification run.
  const [compare, setCompare] = useState<null | {
    baseline: string;
    current: string;
    match: boolean;
  }>(null);
  const [hashExpanded, setHashExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewDraft, setReviewDraft] = useState("");

  useEffect(() => {
    if (item) {
      setResult(null);
      setRevealed(false);
      setCompare(null);
      setHashExpanded(false);
      setEditing(false);
      setDraftContent(item.content);
      setNotes(item.notes);
      setReviewDraft(item.reviewNote ?? "");
    }
  }, [item?.id, item?.hashStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;
  const Icon = EVIDENCE_ICON[item.type] ?? Fingerprint;

  const copy = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    if (ok) toast.success(`${label} copied`, { duration: 1400 });
  };

  const handleHash = async () => {
    setBusy("hash");
    const ok = await generateHash(caseId, item.id);
    setBusy(null);
    if (ok) {
      setResult(null);
      toast.success("SHA-256 hash generated — not yet verified", {
        duration: 2200,
      });
    }
  };

  const handleVerify = async () => {
    setBusy("verify");
    const outcome = await verifyEvidence(caseId, item.id);
    setBusy(null);
    setResult(outcome);
    if (outcome === "match" || outcome === "mismatch") {
      // Same sha256Hex helper and the same `content` field the backend hashed,
      // so the two digests below are genuinely comparable.
      try {
        const current = await sha256Hex(item.content);
        setCompare({
          baseline: item.hash ?? "",
          current,
          match: outcome === "match",
        });
      } catch {
        setCompare(null);
      }
    } else {
      setCompare(null);
    }
    if (outcome === "generated") {
      toast.info(
        "No recorded hash existed — one was generated from current content. Independent verification has not yet been performed.",
        { duration: 3400 },
      );
    }
  };

  const handleRebaseline = async () => {
    const reason = rebaselineReason.trim();
    if (reason.length < 3) {
      toast.error("A recorded reason is required to re-baseline a hash.");
      return;
    }
    setBusy("rebaseline");
    const ok = await rebaselineEvidence(caseId, item.id, reason);
    setBusy(null);
    if (ok) {
      setRebaselineOpen(false);
      setRebaselineReason("");
      setResult(null);
      toast.success(
        "Hash re-baselined with a recorded reason — re-run verification to check the new baseline.",
        { duration: 3400 },
      );
    }
  };

  const saveContent = () => {
    setEvidenceContent(caseId, item.id, draftContent);
    setEditing(false);
    setResult(null);
    toast.warning("Content modified — verify to observe the integrity check", {
      duration: 2600,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-jborder/80 bg-popover p-0 sm:max-w-lg [&>button]:text-jmuted"
      >
        <SheetHeader className="border-b border-jborder/70 px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-jtext">
            <span className="flex size-7 items-center justify-center border border-jcyan/50 bg-jcyan/10 text-jcyan">
              <Icon className="size-4" />
            </span>
            Evidence detail
            <Chip style={HASH_STYLE[item.hashStatus]} className="ml-auto">
              {HASH_LABEL[item.hashStatus]}
            </Chip>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-5 py-4">
          {/* Value */}
          <div>
            <div className="flex items-center justify-between">
              <p className="jaal-label">Full extracted value</p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-jmuted hover:text-jcyan"
                  onClick={() => setRevealed((r) => !r)}
                  aria-pressed={revealed}
                  title={revealed ? "Hide value" : "Reveal value"}
                >
                  {revealed ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-jmuted hover:text-jcyan"
                  onClick={() => copy(item.value, "Value")}
                  title="Copy value"
                >
                  <ClipboardCopy className="size-3.5" />
                </Button>
              </div>
            </div>
            <p className="mt-1 break-all border border-jborder/70 bg-jsurface px-3 py-2 font-mono text-sm text-jcyan">
              {revealed ? item.value : maskValue(item.value)}
            </p>
            {!revealed && (
              <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-jmuted/60">
                masked — use the eye control to reveal
              </p>
            )}
            <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-jamber">
              <AlertTriangle className="size-3" /> synthetic demo identifier —
              not verified against any real-world record
            </p>
          </div>

          {/* Source */}
          <div>
            <p className="jaal-label">Source message</p>
            <div className="mt-1 border-l-2 border-jred/60 bg-jred/[0.05] px-3 py-2">
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-jtext/90">
                {item.sourceMessageText || "No source message recorded."}
              </p>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-2 font-mono text-[10px] text-jmuted">
              <span>case: <span className="text-jcyan">{item.caseId}</span></span>
              <span>extracted: {formatDateTime(item.extractedAt)}</span>
            </div>
            {onOpenSource && item.sourceMessageId && (
              <Button
                size="sm"
                onClick={onOpenSource}
                className="mt-2 h-7 cursor-pointer gap-1.5 border border-jcyan/50 bg-jcyan/10 px-2.5 font-mono text-[10px] uppercase tracking-wider text-jcyan hover:bg-jcyan/20 hover:text-jcyan"
              >
                <ExternalLink className="size-3" /> Open original message
              </Button>
            )}
          </div>

          {/* Integrity */}
          <div className="jaal-hud relative border border-jborder/70 bg-jsurface p-3">
            <div className="flex items-center justify-between">
              <p className="jaal-label">Integrity (SHA-256 · Web Crypto)</p>
              <Badge
                variant="outline"
                className="border font-mono text-[9px] uppercase tracking-widest"
                style={statusStyle("integrity", integrityKey(item.hashStatus))}
              >
                {HASH_LABEL[item.hashStatus]}
              </Badge>
            </div>

            {item.hash ? (
              <div className="mt-2">
                <div className="flex items-center justify-between gap-2 border border-jborder/60 bg-background px-2.5 py-1.5">
                  <code
                    onClick={() => setHashExpanded((v) => !v)}
                    title={hashExpanded ? "Collapse hash" : "Expand full hash"}
                    className={cn(
                      "min-w-0 cursor-pointer select-text font-mono text-[10px] text-jteal",
                      hashExpanded ? "break-all" : "truncate",
                    )}
                  >
                    {item.hash}
                  </code>
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setHashExpanded((v) => !v)}
                      aria-label={hashExpanded ? "Collapse hash" : "Expand full hash"}
                      aria-expanded={hashExpanded}
                      className="text-jmuted transition-colors hover:text-jcyan"
                      title={hashExpanded ? "Collapse" : "Expand full 64-character digest"}
                    >
                      {hashExpanded ? (
                        <Minimize2 className="size-3.5" />
                      ) : (
                        <Maximize2 className="size-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => copy(item.hash!, "Hash")}
                      className="text-jmuted transition-colors hover:text-jcyan"
                      title="Copy hash"
                      aria-label="Copy hash"
                    >
                      <ClipboardCopy className="size-3.5" />
                    </button>
                  </span>
                </div>
                <p className="mt-1 font-mono text-[9px] text-jmuted/70">
                  recorded {item.hashGeneratedAt ? formatDateTime(item.hashGeneratedAt) : "—"} ·{" "}
                  {shortHash(item.hash, 16)}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-jmuted">
                Evidence collected — no hash recorded yet.
              </p>
            )}

            <p className="mt-2 border-l-2 border-jteal/50 pl-2 text-[10px] leading-relaxed text-jmuted/80">
              SHA-256 proves this content matches the recorded baseline — it
              does not prove who created it, that the source message is
              genuine, that timestamps are accurate, or legal admissibility.
              No external immutable storage or trusted timestamping is used.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={handleHash}
                disabled={busy !== null}
                className="h-7 cursor-pointer gap-1.5 bg-jcyan px-2.5 font-mono text-[10px] uppercase tracking-wider text-background hover:bg-jcyan/85"
              >
                {busy === "hash" ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Fingerprint className="size-3" />
                )}
                {item.hash ? "Re-generate hash" : "Generate SHA-256 hash"}
              </Button>
              {(item.hashStatus === "mismatch" || item.tampered) && (
                <Button
                  size="sm"
                  onClick={() => setRebaselineOpen((o) => !o)}
                  disabled={busy !== null}
                  className="h-7 cursor-pointer gap-1.5 border border-jamber/50 bg-jamber/10 px-2.5 font-mono text-[10px] uppercase tracking-wider text-jamber hover:bg-jamber/20 hover:text-jamber"
                >
                  <History className="size-3" /> Re-baseline hash…
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleVerify}
                disabled={busy !== null || !item.hash}
                title={item.hash ? "Verify content against recorded hash" : "Generate a hash first"}
                className="h-7 cursor-pointer gap-1.5 border border-jgreen/50 bg-jgreen/10 px-2.5 font-mono text-[10px] uppercase tracking-wider text-jgreen hover:bg-jgreen/20 hover:text-jgreen disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === "verify" ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <ShieldCheck className="size-3" />
                )}
                Verify integrity
              </Button>
            </div>

            {/* Explicit re-baseline flow for mismatched items — always needs a
                recorded reason; the original hash stays in history. */}
            {rebaselineOpen && (
              <div className="mt-3 border border-jamber/40 bg-jamber/5 p-2.5">
                <p className="jaal-label">Re-baseline hash · recorded reason</p>
                <p className="mt-1 text-[10px] leading-relaxed text-jmuted">
                  Replaces the recorded baseline with a hash of the CURRENT
                  content. The original hash and all prior results stay in
                  history; the item is never auto-marked verified.
                </p>
                <Textarea
                  value={rebaselineReason}
                  onChange={(e) => setRebaselineReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. Corrected snapshot after analyst edit (demo)"
                  className="mt-2 border-jborder/70 bg-background font-mono text-[11px] text-jtext focus-visible:border-jamber/70 focus-visible:ring-jamber/40"
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleRebaseline}
                    disabled={busy !== null}
                    className="h-7 cursor-pointer gap-1.5 bg-jamber px-2.5 font-mono text-[10px] uppercase tracking-wider text-background hover:bg-jamber/85"
                  >
                    {busy === "rebaseline" ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <History className="size-3" />
                    )}
                    Record re-baseline
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRebaselineOpen(false)}
                    className="h-7 cursor-pointer font-mono text-[10px] uppercase tracking-wider text-jmuted"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`mt-3 flex items-start gap-2 border px-2.5 py-2 ${
                    result === "match"
                      ? "border-jgreen/50 bg-jgreen/10"
                      : result === "mismatch"
                        ? "border-jred/50 bg-jred/10"
                        : "border-jcyan/50 bg-jcyan/10"
                  }`}
                >
                  {result === "match" ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-jgreen" />
                  ) : result === "mismatch" ? (
                    <XCircle className="mt-0.5 size-3.5 shrink-0 text-jred" />
                  ) : (
                    <FileWarning className="mt-0.5 size-3.5 shrink-0 text-jcyan" />
                  )}
                  <p
                    className={`text-[11px] leading-relaxed ${
                      result === "match"
                        ? "text-jgreen"
                        : result === "mismatch"
                          ? "text-jred"
                          : "text-jcyan"
                    }`}
                  >
                    {result === "match"
                      ? "Content matches the recorded hash. The bytes are unchanged since recording — this does not prove the identifier is genuine or admissible."
                      : result === "mismatch"
                        ? "Hash mismatch — the stored content no longer matches the recorded hash. Treat this item as altered."
                        : "No recorded hash was available; a new hash was generated from the current content."}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Baseline vs current — only shown after a real verification run */}
            {compare && (
              <div
                className={cn(
                  "mt-3 border p-2.5",
                  compare.match
                    ? "border-jgreen/50 bg-jgreen/[0.07]"
                    : "border-jred/50 bg-jred/[0.07]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="jaal-label">Verification comparison</p>
                  <span
                    className={cn(
                      "border px-1.5 py-px font-mono text-[9px] uppercase tracking-widest",
                      compare.match
                        ? "border-jgreen/50 bg-jgreen/10 text-jgreen"
                        : "border-jred/50 bg-jred/10 text-jred",
                    )}
                  >
                    {compare.match ? "digests match" : "digests differ"}
                  </span>
                </div>

                <div className="mt-2 grid gap-2">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-jmuted/70">
                      Recorded baseline
                    </p>
                    <code className="mt-0.5 block break-all border border-jborder/60 bg-background px-2 py-1 font-mono text-[10px] leading-relaxed text-jteal">
                      {compare.baseline || "—"}
                    </code>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-jmuted/70">
                      Hash of current content
                    </p>
                    <code
                      className={cn(
                        "mt-0.5 block break-all border bg-background px-2 py-1 font-mono text-[10px] leading-relaxed",
                        compare.match
                          ? "border-jgreen/40 text-jgreen"
                          : "border-jred/40 text-jred",
                      )}
                    >
                      {compare.current}
                    </code>
                  </div>
                </div>

                <p className="mt-2 text-[10px] leading-relaxed text-jmuted/80">
                  {compare.match
                    ? "Both digests are identical, so the recorded bytes are unchanged since the baseline was taken. This says nothing about whether the identifier is genuine or admissible."
                    : "The digests differ — the stored content changed after the baseline was recorded. The original baseline is preserved; re-baselining requires a recorded reason."}
                </p>
              </div>
            )}

            {/* Integrity demo: modify content and re-verify */}
            <div className="mt-3 border-t border-jborder/60 pt-3">
              <div className="flex items-center justify-between">
                <p className="jaal-label">Integrity demo · modify content</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing((e) => !e)}
                  className="h-6 cursor-pointer gap-1 px-1.5 font-mono text-[9px] uppercase tracking-wider text-jmuted hover:text-jamber"
                >
                  <Pencil className="size-3" /> {editing ? "cancel" : "edit"}
                </Button>
              </div>
              {editing ? (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    rows={5}
                    className="border-jborder/70 bg-background font-mono text-[11px] text-jtext focus-visible:border-jamber/70 focus-visible:ring-jamber/40"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={saveContent}
                      disabled={!draftContent.trim()}
                      className="h-7 cursor-pointer bg-jamber font-mono text-[10px] uppercase tracking-wider text-background hover:bg-jamber/85"
                    >
                      Save altered content
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDraftContent(item.content)}
                      className="h-7 cursor-pointer border-jborder/70 font-mono text-[10px] uppercase tracking-wider text-jmuted"
                    >
                      Restore
                    </Button>
                  </div>
                  <p className="text-[10px] leading-relaxed text-jmuted">
                    Alter the stored content, then run{" "}
                    <span className="text-jgreen">Verify integrity</span> — the
                    recomputed hash will no longer match the recorded one.
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-[10px] leading-relaxed text-jmuted">
                  Demonstrates the difference between{" "}
                  <span className="text-jcyan">evidence collected</span>,{" "}
                  <span className="text-jcyan">hash generated</span> and{" "}
                  <span className="text-jgreen">hash verified</span> — and how a
                  content change flips it to{" "}
                  <span className="text-jred">hash mismatch</span>.
                </p>
              )}
            </div>
          </div>

          {/* Analyst review — verdict stored separately from the extraction */}
          <div className="border border-jborder/70 bg-jsurface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="jaal-label">Analyst review</p>
              {item.reviewedAt && (
                <span className="font-mono text-[9px] uppercase tracking-widest text-jmuted/70">
                  reviewed {formatDateTime(item.reviewedAt)}
                </span>
              )}
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-jmuted">
              Record your verdict on this extraction. The review is stored
              separately — the original value, content and hash are never
              altered.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(
                [
                  {
                    status: "confirmed" as const,
                    label: "Confirmed",
                    Icon: CheckCircle2,
                    style: statusStyle("review", "confirmed"),
                  },
                  {
                    status: "incorrect" as const,
                    label: "Incorrect",
                    Icon: XCircle,
                    style: statusStyle("review", "incorrect"),
                  },
                  {
                    status: "needs_review" as const,
                    label: "Needs review",
                    Icon: AlertTriangle,
                    style: statusStyle("review", "needsreview"),
                  },
                ]
              ).map(({ status, label, Icon, style }) => {
                const active = item.reviewStatus === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      reviewEvidence(caseId, item.id, status);
                      toast.success(`Analyst review saved · ${label}`, {
                        duration: 1600,
                      });
                    }}
                    style={style}
                    className={cn(
                      "flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-[filter,box-shadow] hover:brightness-125",
                      active && "ring-1 ring-current",
                    )}
                  >
                    <Icon className="size-3" /> {label}
                    {active && <span className="text-[8px]">· current</span>}
                  </button>
                );
              })}
            </div>
            <Textarea
              value={reviewDraft}
              onChange={(e) => setReviewDraft(e.target.value)}
              onBlur={() =>
                reviewEvidence(
                  caseId,
                  item.id,
                  item.reviewStatus ?? "needs_review",
                  reviewDraft,
                )
              }
              rows={2}
              placeholder="Review note (why confirmed / incorrect)…"
              className="mt-2 border-jborder/70 bg-background font-mono text-[11px] text-jtext placeholder:text-jmuted/40 focus-visible:border-jcyan/70 focus-visible:ring-jcyan/40"
            />
          </div>

          {/* Notes */}
          <div>
            <p className="jaal-label">Analyst notes</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => setEvidenceNotes(caseId, item.id, notes)}
              rows={3}
              placeholder="Observations about this item…"
              className="mt-1 border-jborder/70 bg-jsurface text-xs text-jtext placeholder:text-jmuted/40 focus-visible:border-jcyan/70 focus-visible:ring-jcyan/40"
            />
          </div>

          {/* Disclaimer */}
          <p className="border border-jamber/30 bg-jamber/[0.07] px-3 py-2 text-[10px] leading-relaxed text-jamber">
            Integrity hashes detect content changes only. They do not establish
            that this identifier belongs to any person, that a crime occurred,
            or that the item is legally admissible. Extracted identifiers are
            labelled leads, never confirmed suspects.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
