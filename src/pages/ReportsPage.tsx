import { Chip, Panel } from "@/components/ui/panel";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useJaal } from "@/state/JaalProvider";
import { SCAM_CATEGORIES } from "@/types/investigation";
import { formatDateTime, pluralize } from "@/utils/formatters";
import { motion } from "framer-motion";
import { FilePlus2, FileText, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

const STATUS_OPTIONS = [
  { id: "all", label: "Any status" },
  { id: "active", label: "Active case" },
  { id: "completed", label: "Completed" },
  { id: "archived", label: "Archived" },
] as const;

const DATE_OPTIONS = [
  { id: "all", label: "Any date" },
  { id: "today", label: "Today" },
  { id: "week", label: "Last 7 days" },
] as const;

/**
 * SCREEN 7 — INVESTIGATION REPORTS.
 *
 * Dense filterable report list. Selecting a row opens the formal report at
 * /reports/:id (10-section layout with export + print).
 */
export default function ReportsPage() {
  const { state, createReport } = useJaal();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [caseFilter, setCaseFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]["id"]>("all");
  const [dateFilter, setDateFilter] = useState<(typeof DATE_OPTIONS)[number]["id"]>("all");

  const reports = useMemo(
    () => [...state.reports].sort((a, b) => b.generatedAt - a.generatedAt),
    [state.reports],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    return reports.filter((r) => {
      if (caseFilter !== "all" && r.caseId !== caseFilter) return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (dateFilter === "today") {
        const d = new Date(r.generatedAt);
        const t = new Date();
        if (d.toDateString() !== t.toDateString()) return false;
      } else if (dateFilter === "week" && now - r.generatedAt > 7 * 864e5) {
        return false;
      }
      if (
        q &&
        !r.id.toLowerCase().includes(q) &&
        !r.caseId.toLowerCase().includes(q) &&
        !r.title.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [reports, query, caseFilter, categoryFilter, statusFilter, dateFilter]);

  // Cases that can still produce a report (evidence present, none generated yet)
  const candidates = useMemo(() => {
    const reportedCases = new Set(state.reports.map((r) => r.caseId));
    return state.investigations.filter(
      (inv) =>
        !reportedCases.has(inv.id) &&
        (state.sessions[inv.id]?.evidence.length ?? 0) > 0,
    );
  }, [state.investigations, state.reports, state.sessions]);

  const handleGenerate = (caseId: string) => {
    const report = createReport(caseId);
    if (report) navigate(`/reports/${report.id}`);
  };

  const selectCls = (active: boolean) =>
    cn(
      "h-8 border bg-jsurface px-2 font-mono text-[10px] uppercase tracking-wider text-jtext outline-none focus:border-jcyan/70",
      active ? "border-jcyan/60" : "border-jborder/70",
    );

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-4"
      >
        <p className="jaal-label">Evidence outputs</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-mono text-2xl font-semibold uppercase tracking-[0.22em] text-jtext sm:text-3xl">
              Investigation reports
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-jmuted">
              Structured evidence reports built from live case state — exportable
              as JSON or printable to PDF through the browser.{" "}
              <span className="text-jamber">
                All demo reports are simulated products of controlled
                conversations.
              </span>
            </p>
          </div>
          <Chip tone="border-jcyan/40 bg-jcyan/10 text-jcyan">
            {pluralize(reports.length, "report")}
          </Chip>
        </div>

        {/* Header filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-jmuted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search report, case, title…"
              className="h-8 w-60 border-jborder/70 bg-jsurface pl-8 font-mono text-xs text-jtext placeholder:text-jmuted/50 focus-visible:border-jcyan/70 focus-visible:ring-jcyan/40"
            />
          </div>
          <select
            value={caseFilter}
            onChange={(e) => setCaseFilter(e.target.value)}
            className={selectCls(caseFilter !== "all")}
          >
            <option value="all">Any case</option>
            {state.investigations.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.id}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={selectCls(categoryFilter !== "all")}
          >
            <option value="all">Any category</option>
            {SCAM_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as (typeof STATUS_OPTIONS)[number]["id"])
            }
            className={selectCls(statusFilter !== "all")}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={dateFilter}
            onChange={(e) =>
              setDateFilter(e.target.value as (typeof DATE_OPTIONS)[number]["id"])
            }
            className={selectCls(dateFilter !== "all")}
          >
            {DATE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-jmuted">
            {filtered.length} / {reports.length} shown
          </span>
        </div>
      </motion.header>

      {candidates.length > 0 && (
        <Panel
          label={
            <div className="flex items-center gap-2">
              <FilePlus2 className="size-3.5 text-jamber" />
              <p className="jaal-label !text-[9px] mb-0">Ready to generate</p>
            </div>
          }
          bodyClassName="p-3"
          className="mb-4"
        >
          <div className="flex flex-wrap gap-2">
            {candidates.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => handleGenerate(inv.id)}
                className="group flex items-center gap-2 border border-jamber/40 bg-jamber/[0.07] px-3 py-2 text-left transition-colors hover:border-jamber/70 hover:bg-jamber/10"
              >
                <span>
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-jamber">
                    {inv.id}
                  </span>
                  <span className="block max-w-52 truncate text-[11px] text-jtext">
                    {inv.title}
                  </span>
                  <span className="block font-mono text-[9px] text-jmuted">
                    {state.sessions[inv.id]?.evidence.length ?? 0} evidence items
                  </span>
                </span>
                <Plus className="size-3.5 shrink-0 text-jamber group-hover:text-jtext" />
              </button>
            ))}
          </div>
        </Panel>
      )}

      {/* Dense report list */}
      <section className="jaal-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-jborder/70 px-3 py-2">
          <p className="jaal-label !text-jcyan !text-[9px] mb-0">Generated reports</p>
          <span className="font-mono text-[9px] uppercase tracking-widest text-jmuted/70">
            simulated reports · synthetic demo data
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <FileText className="size-7 text-jmuted/50" />
            <p className="text-sm text-jmuted">No reports match these filters.</p>
            <p className="max-w-md text-[11px] leading-relaxed text-jmuted/70">
              Complete or pause a simulation, then generate a report from the
              investigation header — or from a case above.
            </p>
            <Link
              to="/investigations"
              className="border border-jcyan/50 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-jcyan transition-colors hover:bg-jcyan/10"
            >
              Go to investigations
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-jborder/70 bg-jsurface/70">
                  {[
                    "Report ID",
                    "Case ID",
                    "Investigation title",
                    "Scam category",
                    "Evidence",
                    "Generated",
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
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/reports/${r.id}`)}
                    className="cursor-pointer border-b border-jborder/40 transition-colors hover:bg-jcyan/[0.05]"
                  >
                    <td className="px-3 py-2 font-mono text-[10px] text-jcyan">
                      {r.id}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-jcyan/80">
                      {r.caseId}
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-xs text-jtext">
                      {r.title}
                    </td>
                    <td className="px-3 py-2 border-b-0">
                      <span className="border border-jborder/60 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-jmuted">
                        {r.category}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-jtext">
                      {r.evidenceCount}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-jmuted">
                      {formatDateTime(r.generatedAt)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "border px-1.5 py-px font-mono text-[9px] uppercase tracking-wider",
                          r.integrity.mismatched > 0
                            ? "border-jred/50 bg-jred/10 text-jred"
                            : r.integrity.verified > 0
                              ? "border-jgreen/50 bg-jgreen/10 text-jgreen"
                              : "border-jamber/50 bg-jamber/10 text-jamber",
                        )}
                      >
                        {r.integrity.mismatched > 0
                          ? "mismatch"
                          : r.integrity.verified > 0
                            ? "verified"
                            : "pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="border-t border-jborder/70 px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-jmuted/60">
          last generated:{" "}
          {reports[0] ? formatDateTime(reports[0].generatedAt) : "—"}
        </p>
      </section>
    </div>
  );
}
