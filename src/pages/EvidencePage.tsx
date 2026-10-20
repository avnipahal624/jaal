import { EvidenceDrawer } from "@/components/evidence/EvidenceDrawer";
import { EVIDENCE_ICON } from "@/components/evidence/EvidenceCard";
import { Chip } from "@/components/ui/panel";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useJaal } from "@/state/JaalProvider";
import { evidenceMatchesFilter } from "@/services/evidenceService";
import type { EvidenceFilter, EvidenceItem } from "@/types/evidence";
import { formatDateTime, formatClock } from "@/utils/formatters";
import { motion } from "framer-motion";
import { Fingerprint, Search, ShieldCheck, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

const TYPE_FILTERS: { id: EvidenceFilter; label: string }[] = [
  { id: "all", label: "All evidence" },
  { id: "upi", label: "UPI / payment" },
  { id: "phone", label: "Phone numbers" },
  { id: "url", label: "Links & refs" },
  { id: "message", label: "Scam messages" },
  { id: "transcript", label: "Transcripts" },
];

const VERIFY_FILTERS = [
  { id: "all", label: "Any status" },
  { id: "verified", label: "Verified" },
  { id: "unverified", label: "Unverified" },
] as const;

type VerifyFilter = (typeof VERIFY_FILTERS)[number]["id"];

/**
 * SCREEN 6 — EVIDENCE ARCHIVE.
 *
 * Filter sidebar (left), dense evidence table (center) and a detail drawer
 * (right sheet) for the selected item.
 */
export default function EvidencePage() {
  const { state } = useJaal();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<EvidenceFilter>("all");
  const [verifyFilter, setVerifyFilter] = useState<VerifyFilter>("all");
  const caseFilter = params.get("case") ?? "all";
  const [openId, setOpenId] = useState<string | null>(null);

  const all = useMemo(() => {
    const items: { item: EvidenceItem; caseId: string }[] = [];
    for (const [caseId, rt] of Object.entries(state.sessions)) {
      for (const item of rt.evidence) items.push({ item, caseId });
    }
    return items.sort((a, b) => b.item.extractedAt - a.item.extractedAt);
  }, [state.sessions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter(({ caseId }) => caseFilter === "all" || caseId === caseFilter)
      .filter(({ item }) => evidenceMatchesFilter(item, typeFilter))
      .filter(({ item }) =>
        verifyFilter === "all" ? true : evidenceMatchesFilter(item, verifyFilter),
      )
      .filter(
        ({ item }) =>
          !q ||
          item.value.toLowerCase().includes(q) ||
          item.label.toLowerCase().includes(q) ||
          item.sourceMessageText.toLowerCase().includes(q) ||
          item.caseId.toLowerCase().includes(q),
      );
  }, [all, typeFilter, verifyFilter, query, caseFilter]);

  const counts = useMemo(() => {
    const byType = new Map<string, number>();
    for (const { item } of all) byType.set(item.type, (byType.get(item.type) ?? 0) + 1);
    return {
      byType,
      verified: all.filter((x) => x.item.hashStatus === "verified").length,
      mismatched: all.filter((x) => x.item.hashStatus === "mismatch").length,
      unhashed: all.filter((x) => !x.item.hash).length,
    };
  }, [all]);

  const caseCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const { caseId } of all) m.set(caseId, (m.get(caseId) ?? 0) + 1);
    return m;
  }, [all]);

  const open = all.find((x) => x.item.id === openId) ?? null;

  const selectCase = (next: string) => {
    const p = new URLSearchParams(params);
    if (next === "all") p.delete("case");
    else p.set("case", next);
    setParams(p, { replace: true });
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-4"
      >
        <p className="jaal-label">Chain of custody · local evidence store</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-mono text-2xl font-semibold uppercase tracking-[0.22em] text-jtext sm:text-3xl">
              Evidence archive
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-jmuted">
              Search extracted identifiers, review source messages and verify
              content integrity with SHA-256.{" "}
              <span className="text-jamber">
                Synthetic demo data — labelled leads, never confirmed suspects.
              </span>
            </p>
          </div>
          {/* Header filters — search, type, verification, case */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-jmuted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search value, source, case…"
                className="h-8 w-56 border-jborder/70 bg-jsurface pl-8 font-mono text-xs text-jtext placeholder:text-jmuted/50 focus-visible:border-jcyan/70 focus-visible:ring-jcyan/40"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as EvidenceFilter)}
              className="h-8 border border-jborder/70 bg-jsurface px-2 font-mono text-[10px] uppercase tracking-wider text-jtext outline-none focus:border-jcyan/70"
            >
              {TYPE_FILTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              value={verifyFilter}
              onChange={(e) => setVerifyFilter(e.target.value as VerifyFilter)}
              className="h-8 border border-jborder/70 bg-jsurface px-2 font-mono text-[10px] uppercase tracking-wider text-jtext outline-none focus:border-jcyan/70"
            >
              {VERIFY_FILTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              value={caseFilter}
              onChange={(e) => selectCase(e.target.value)}
              className="h-8 border border-jborder/70 bg-jsurface px-2 font-mono text-[10px] uppercase tracking-wider text-jtext outline-none focus:border-jcyan/70"
            >
              <option value="all">All cases</option>
              {state.investigations.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.id}
                </option>
              ))}
            </select>
          </div>
        </div>
      </motion.header>

      <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
        {/* LEFT — filter sidebar */}
        <aside className="jaal-panel h-fit p-3">
          <p className="jaal-label mb-2">Evidence categories</p>
          <ul className="space-y-1">
            {TYPE_FILTERS.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setTypeFilter(f.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 border px-2 py-1.5 text-left font-mono text-[10px] uppercase tracking-wider transition-colors",
                    typeFilter === f.id
                      ? "border-jcyan/60 bg-jcyan/10 text-jcyan"
                      : "border-transparent text-jmuted hover:border-jborder/70 hover:text-jtext",
                  )}
                >
                  <span>{f.label}</span>
                  <span className="tabular-nums opacity-70">
                    {f.id === "all"
                      ? all.length
                      : (() => {
                          let n = 0;
                          for (const { item } of all)
                            if (evidenceMatchesFilter(item, f.id)) n += 1;
                          return n;
                        })()}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <p className="jaal-label mb-2 mt-4">Verification</p>
          <ul className="space-y-1">
            {VERIFY_FILTERS.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setVerifyFilter(f.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 border px-2 py-1.5 text-left font-mono text-[10px] uppercase tracking-wider transition-colors",
                    verifyFilter === f.id
                      ? "border-jcyan/60 bg-jcyan/10 text-jcyan"
                      : "border-transparent text-jmuted hover:border-jborder/70 hover:text-jtext",
                  )}
                >
                  <span>{f.label}</span>
                  <span className="tabular-nums opacity-70">
                    {f.id === "verified"
                      ? counts.verified
                      : f.id === "unverified"
                        ? all.length - counts.verified
                        : all.length}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {counts.mismatched > 0 && (
            <div className="mt-3 flex items-center gap-1.5 border border-jred/50 bg-jred/10 px-2 py-1.5">
              <ShieldAlert className="size-3.5 shrink-0 text-jred" />
              <span className="font-mono text-[9px] uppercase tracking-wider text-jred">
                {counts.mismatched} hash mismatch
              </span>
            </div>
          )}

          <p className="jaal-label mb-2 mt-4">Case selection</p>
          <ul className="space-y-1">
            <li>
              <button
                type="button"
                onClick={() => selectCase("all")}
                className={cn(
                  "flex w-full items-center justify-between gap-2 border px-2 py-1.5 text-left font-mono text-[10px] uppercase tracking-wider transition-colors",
                  caseFilter === "all"
                    ? "border-jcyan/60 bg-jcyan/10 text-jcyan"
                    : "border-transparent text-jmuted hover:border-jborder/70 hover:text-jtext",
                )}
              >
                <span>All cases</span>
                <span className="tabular-nums opacity-70">{all.length}</span>
              </button>
            </li>
            {state.investigations.map((inv) => (
              <li key={inv.id}>
                <button
                  type="button"
                  onClick={() => selectCase(inv.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 border px-2 py-1.5 text-left font-mono text-[10px] uppercase tracking-wider transition-colors",
                    caseFilter === inv.id
                      ? "border-jcyan/60 bg-jcyan/10 text-jcyan"
                      : "border-transparent text-jmuted hover:border-jborder/70 hover:text-jtext",
                  )}
                >
                  <span className="truncate">{inv.id}</span>
                  <span className="tabular-nums opacity-70">
                    {caseCounts.get(inv.id) ?? 0}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* CENTER — dense evidence table */}
        <section className="jaal-panel min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-jborder/70 px-3 py-2">
            <p className="jaal-label !text-jcyan mb-0">
              Evidence records
            </p>
            <span className="font-mono text-[10px] uppercase tracking-wider text-jmuted">
              {filtered.length} / {all.length} shown
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Fingerprint className="size-7 text-jmuted/50" />
              <p className="text-sm text-jmuted">No evidence matches these filters.</p>
              <p className="max-w-sm text-[11px] leading-relaxed text-jmuted/70">
                Evidence is extracted automatically while a simulation runs —
                open an investigation and let the conversation progress.
              </p>
              <Link
                to="/investigations"
                className="mt-1 border border-jcyan/50 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-jcyan transition-colors hover:bg-jcyan/10"
              >
                Open investigations
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-jborder/70 bg-jsurface/70">
                    {[
                      "Evidence ID",
                      "Type",
                      "Extracted value",
                      "Case",
                      "Source",
                      "Timestamp",
                      "Integrity",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-jmuted"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ item, caseId }) => {
                    const srcMsg = state.sessions[caseId]?.messages.find(
                      (m) => m.id === item.sourceMessageId,
                    );
                    const srcIndex = srcMsg
                      ? state.sessions[caseId].messages.indexOf(srcMsg) + 1
                      : null;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setOpenId(item.id)}
                        className={cn(
                          "cursor-pointer border-b border-jborder/40 transition-colors hover:bg-jcyan/[0.05]",
                          openId === item.id && "bg-jcyan/[0.08]",
                        )}
                      >
                        <td className="px-3 py-2 font-mono text-[10px] text-jmuted">
                          {item.id.slice(0, 14)}…
                        </td>
                        <td className="px-3 py-2">
                          {(() => {
                            const TypeIcon = EVIDENCE_ICON[item.type];
                            return (
                              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-jcyan">
                                <TypeIcon className="size-3" />
                                {item.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="max-w-[260px] truncate px-3 py-2 font-mono text-[11px] text-jtext">
                          {item.value}
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-jcyan/80">
                          {caseId}
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-jmuted">
                          {srcIndex
                            ? `MESSAGE #${String(srcIndex).padStart(2, "0")}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-jmuted">
                          {formatClock(item.extractedAt)}
                          <span className="ml-1 opacity-60">
                            {formatDateTime(item.extractedAt).split(",")[0]}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "border px-1.5 py-px font-mono text-[9px] uppercase tracking-wider",
                              item.hashStatus === "verified"
                                ? "border-jgreen/50 bg-jgreen/10 text-jgreen"
                                : item.hashStatus === "mismatch"
                                  ? "border-jred/50 bg-jred/10 text-jred"
                                  : item.hashStatus === "generated"
                                    ? "border-jcyan/50 bg-jcyan/10 text-jcyan"
                                    : "border-jamber/50 bg-jamber/10 text-jamber",
                            )}
                          >
                            {item.hash ? item.hashStatus : "no hash"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-jborder/70 px-3 py-2">
            <Chip tone="border-jgreen/40 bg-jgreen/10 text-jgreen" className="!text-[9px]">
              <ShieldCheck className="mr-1 inline size-3" />
              {counts.verified} verified
            </Chip>
            <Chip tone="border-jcyan/40 bg-jcyan/10 text-jcyan" className="!text-[9px]">
              {counts.unhashed} awaiting hash
            </Chip>
            <span className="font-mono text-[9px] uppercase tracking-widest text-jmuted/70">
              hashes prove content integrity only — not identity, origin or guilt
            </span>
          </div>
        </section>
      </div>

      {/* RIGHT — detail drawer (sheet on desktop, full-screen on mobile) */}
      <EvidenceDrawer
        open={openId !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
        item={open?.item ?? null}
        caseId={open?.caseId ?? ""}
        onOpenSource={
          open?.item.sourceMessageId
            ? () =>
                navigate(
                  `/investigations/${open.caseId}?msg=${open.item.sourceMessageId}`,
                )
            : undefined
        }
      />
    </div>
  );
}
