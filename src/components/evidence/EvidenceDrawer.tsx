import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Chip, HASH_LABEL, HASH_TONE } from "@/components/ui/panel";
import { EVIDENCE_ICON } from "./EvidenceCard";
import { useJaal } from "@/state/JaalProvider";
import type { EvidenceItem } from "@/types/evidence";
import { formatDateTime } from "@/utils/formatters";
import { copyToClipboard } from "@/utils/export";
import { shortHash } from "@/utils/hash";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  FileWarning,
  Fingerprint,
  Loader2,
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
    setEvidenceContent,
    setEvidenceNotes,
    reviewEvidence,
  } = useJaal();
  const [busy, setBusy] = useState<null | "hash" | "verify">(null);
  const [result, setResult] = useState<null | "match" | "mismatch" | "error">(null);
  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewDraft, setReviewDraft] = useState("");

  useEffect(() => {
    if (item) {
      setResult(null);
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
    await generateHash(caseId, item.id);
    setBusy(null);
    setResult(null);
    toast.success("SHA-256 hash generated", { duration: 1600 });
  };

  const handleVerify = async () => {
    setBusy("verify");
    const outcome = await verifyEvidence(caseId, item.id);
    setBusy(null);
    setResult(outcome);
    if (outcome === "error" && !item.hash) {
      toast.info("No recorded hash yet — one was generated from current content.");
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
            <Chip tone={HASH_TONE[item.hashStatus]} className="ml-auto">
              {HASH_LABEL[item.hashStatus]}
            </Chip>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-5 py-4">
          {/* Value */}
          <div>
            <div className="flex items-center justify-between">
              <p className="jaal-label">Full extracted value</p>
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
            <p className="mt-1 break-all border border-jborder/70 bg-jsurface px-3 py-2 font-mono text-sm text-jcyan">
              {item.value}
            </p>
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
                className={`border-0 font-mono text-[9px] uppercase tracking-widest ${
                  item.hashStatus === "verified"
                    ? "bg-jgreen/15 text-jgreen"
                    : item.hashStatus === "mismatch"
                      ? "bg-jred/15 text-jred"
                      : item.hashStatus === "generated"
                        ? "bg-jcyan/15 text-jcyan"
                        : "bg-jsurface text-jmuted"
                }`}
              >
                {HASH_LABEL[item.hashStatus]}
              </Badge>
            </div>

            {item.hash ? (
              <div className="mt-2">
                <div className="flex items-center justify-between gap-2 border border-jborder/60 bg-background px-2.5 py-1.5">
                  <code className="truncate font-mono text-[10px] text-jteal">
                    {item.hash}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy(item.hash!, "Hash")}
                    className="shrink-0 text-jmuted transition-colors hover:text-jcyan"
                    title="Copy hash"
                  >
                    <ClipboardCopy className="size-3.5" />
                  </button>
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
                    tone:
                      "border-jgreen/50 bg-jgreen/10 text-jgreen hover:bg-jgreen/20",
                  },
                  {
                    status: "incorrect" as const,
                    label: "Incorrect",
                    Icon: XCircle,
                    tone: "border-jred/50 bg-jred/10 text-jred hover:bg-jred/20",
                  },
                  {
                    status: "needs_review" as const,
                    label: "Needs review",
                    Icon: AlertTriangle,
                    tone:
                      "border-jamber/50 bg-jamber/10 text-jamber hover:bg-jamber/20",
                  },
                ]
              ).map(({ status, label, Icon, tone }) => {
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
                    className={cn(
                      "flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
                      tone,
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
