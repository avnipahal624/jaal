import { EvidenceCard } from "@/components/evidence/EvidenceCard";
import { EvidenceDrawer } from "@/components/evidence/EvidenceDrawer";
import { StatTile } from "@/components/dashboard/StatTile";
import { Chip, Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { useJaal } from "@/state/JaalProvider";
import { evidenceMatchesFilter } from "@/services/evidenceService";
import type { EvidenceFilter, EvidenceItem } from "@/types/evidence";
import { motion } from "framer-motion";
import {
  ExternalLink,
  Fingerprint,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Input } from "@/components/ui/input";

const FILTERS: { id: EvidenceFilter; label: string }[] = [
  { id: "all", label: "All evidence" },
  { id: "upi", label: "UPI / payment" },
  { id: "phone", label: "Phone numbers" },
  { id: "url", label: "Links" },
  { id: "message", label: "Messages" },
  { id: "transcript", label: "Transcripts" },
  { id: "verified", label: "Verified" },
  { id: "unverified", label: "Unverified" },
];

export default function EvidencePage() {
  const { state } = useJaal();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [filter, setFilter] = useState<EvidenceFilter>("all");
  const [query, setQuery] = useState("");
  // Case filter is derived from the URL so it survives refresh/back.
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
      .filter(({ item }) => evidenceMatchesFilter(item, filter))
      .filter(
        ({ item }) =>
          !q ||
          item.value.toLowerCase().includes(q) ||
          item.label.toLowerCase().includes(q) ||
          item.sourceMessageText.toLowerCase().includes(q) ||
          item.caseId.toLowerCase().includes(q),
      );
  }, [all, filter, query, caseFilter]);

  const summary = useMemo(() => {
    const items = all.map((x) => x.item);
    return {
      collected: items.length,
      hashed: items.filter((e) => e.hash).length,
      verified: items.filter((e) => e.hashStatus === "verified").length,
      mismatched: items.filter((e) => e.hashStatus === "mismatch").length,
      unverified: items.filter((e) => e.hashStatus === "none").length,
    };
  }, [all]);

  const openItem = all.find((x) => x.item.id === openId)?.item ?? null;
  const openItemCase = openItem?.caseId ?? "";

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
        className="mb-5"
      >
        <p className="jaal-label">Chain of custody · local evidence store</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-jtext sm:text-3xl">
              Evidence locker
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-jmuted">
              Search extracted identifiers, review their source messages and
              verify content integrity with SHA-256. Synthetic demo data —
              labelled leads, never confirmed suspects.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {state.investigations.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => selectCase(caseFilter === inv.id ? "all" : inv.id)}
                className={cn(
                  "border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
                  caseFilter === inv.id
                    ? "border-jcyan/60 bg-jcyan/15 text-jcyan"
                    : "border-jborder/70 text-jmuted hover:border-jcyan/40 hover:text-jtext",
                )}
              >
                {inv.id}
              </button>
            ))}
          </div>
        </div>
      </motion.header>

      {/* Integrity summary */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Evidence collected"
          value={summary.collected}
          hint="All extracted items"
          tone="text-jcyan"
          bar="bg-jcyan"
          icon={<Fingerprint className="size-4" />}
        />
        <StatTile
          label="Hash generated"
          value={summary.hashed}
          hint={`${summary.unverified} without hash`}
          tone="text-jteal"
          bar="bg-jteal"
          icon={<ShieldQuestion className="size-4" />}
        />
        <StatTile
          label="Integrity verified"
          value={summary.verified}
          hint="Content matches recorded hash"
          tone="text-jgreen"
          bar="bg-jgreen"
          icon={<ShieldCheck className="size-4" />}
        />
        <StatTile
          label="Hash mismatch"
          value={summary.mismatched}
          hint="Content changed since recording"
          tone="text-jred"
          bar="bg-jred"
          icon={<ShieldAlert className="size-4" />}
        />
      </div>

      <Panel
        right={
          <div className="relative w-full max-w-64">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-jmuted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search value, source, case…"
              className="h-8 border-jborder/70 bg-jsurface pl-8 font-mono text-xs text-jtext placeholder:text-jmuted/50 focus-visible:border-jcyan/70 focus-visible:ring-jcyan/40"
            />
          </div>
        }
        bodyClassName="p-3"
      >
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
                filter === f.id
                  ? "border-jcyan/60 bg-jcyan/15 text-jcyan"
                  : "border-jborder/70 text-jmuted hover:border-jcyan/40 hover:text-jtext",
              )}
            >
              {f.label}
            </button>
          ))}
          <Chip tone="border-jborder/70 bg-jsurface text-jmuted" className="ml-auto">
            {filtered.length} shown
          </Chip>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Fingerprint className="size-7 text-jmuted/50" />
            <p className="text-sm text-jmuted">
              No evidence matches these filters.
            </p>
            <p className="max-w-sm text-[11px] leading-relaxed text-jmuted/70">
              Evidence is extracted automatically while a simulation runs — open
              an investigation and let the conversation progress.
            </p>
            <Link
              to="/investigations"
              className="mt-1 border border-jcyan/50 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-jcyan transition-colors hover:bg-jcyan/10"
            >
              Open investigations
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map(({ item, caseId }) => (
              <div key={item.id} className="flex flex-col gap-1.5">
                <EvidenceCard
                  item={item}
                  onOpen={() => setOpenId(item.id)}
                  onOpenSource={
                    item.sourceMessageId
                      ? () =>
                          navigate(
                            `/investigations/${caseId}?msg=${item.sourceMessageId}`,
                          )
                      : undefined
                  }
                />
                <div className="flex items-center justify-between px-0.5">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-jcyan/70">
                    {caseId}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate(`/investigations/${caseId}`)}
                    className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-jmuted transition-colors hover:text-jcyan"
                  >
                    <ExternalLink className="size-3" /> open case
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Integrity explainer */}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          {
            title: "Evidence collected",
            body: "An identifier or message is captured with its source context. It is an unverified lead at this point.",
            tone: "text-jcyan border-jcyan/40",
          },
          {
            title: "Hash generated",
            body: "A SHA-256 digest of the stored content is recorded with a timestamp for later comparison.",
            tone: "text-jteal border-jteal/40",
          },
          {
            title: "Hash verified",
            body: "Content is re-hashed and compared. A match proves the bytes are unchanged — not authenticity or guilt.",
            tone: "text-jgreen border-jgreen/40",
          },
        ].map((c) => (
          <div key={c.title} className={`border bg-jsurface/70 p-3 ${c.tone}`}>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em]">
              {c.title}
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-jmuted">
              {c.body}
            </p>
          </div>
        ))}
      </div>

      <EvidenceDrawer
        open={openId !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
        item={openItem}
        caseId={openItemCase}
      />
    </div>
  );
}
