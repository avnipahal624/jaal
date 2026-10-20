import { ReportCard } from "@/components/reports/ReportCard";
import { Button } from "@/components/ui/button";
import { Chip, Panel } from "@/components/ui/panel";
import { useJaal } from "@/state/JaalProvider";
import { formatDateTime, pluralize } from "@/utils/formatters";
import { motion } from "framer-motion";
import { FilePlus2, FileText, Plus } from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router";

export default function ReportsPage() {
  const { state, createReport } = useJaal();
  const navigate = useNavigate();

  const reports = useMemo(
    () => [...state.reports].sort((a, b) => b.generatedAt - a.generatedAt),
    [state.reports],
  );

  // Cases that can still produce a report (evidence present, none generated yet)
  const candidates = useMemo(() => {
    const reportedCases = new Set(state.reports.map((r) => r.caseId));
    return state.investigations.filter(
      (inv) =>
        !reportedCases.has(inv.id) && (state.sessions[inv.id]?.evidence.length ?? 0) > 0,
    );
  }, [state.investigations, state.reports, state.sessions]);

  const handleGenerate = (caseId: string) => {
    const report = createReport(caseId);
    if (report) navigate(`/reports/${report.id}`);
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <p className="jaal-label">Evidence outputs</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-jtext sm:text-3xl">
            Reports
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-jmuted">
            Structured evidence reports built from live case state — exportable
            as JSON or printable to PDF through the browser.{" "}
            <span className="text-jamber">
              All demo reports are simulated products of controlled conversations.
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip tone="border-jcyan/40 bg-jcyan/10 text-jcyan">
            {pluralize(reports.length, "report")}
          </Chip>
        </div>
      </motion.header>

      {candidates.length > 0 && (
        <Panel
          label={
            <div className="flex items-center gap-2">
              <FilePlus2 className="size-3.5 text-jamber" />
              <p className="jaal-label">Ready to generate</p>
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

      <Panel
        label={<p className="jaal-label">Generated reports</p>}
        bodyClassName="p-3"
      >
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <FileText className="size-7 text-jmuted/50" />
            <p className="text-sm text-jmuted">No reports generated yet.</p>
            <p className="max-w-md text-[11px] leading-relaxed text-jmuted/70">
              Complete or pause a simulation, then generate a report from the
              investigation header — or from a case above.
            </p>
            <Button
              asChild
              variant="outline"
              className="cursor-pointer gap-2 border-jcyan/40 text-jcyan hover:bg-jcyan/10 hover:text-jcyan"
            >
              <Link to="/investigations">
                Go to investigations <Plus className="size-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <ReportCard key={r.id} report={r} />
            ))}
          </div>
        )}
      </Panel>

      <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-jmuted/60">
        last generated:{" "}
        {reports[0] ? formatDateTime(reports[0].generatedAt) : "—"}
      </p>
    </div>
  );
}
