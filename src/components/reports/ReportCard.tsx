import { Chip } from "@/components/ui/panel";
import { exportReportJson, printReport } from "@/services/reportService";
import type { EvidenceReport } from "@/types/report";
import { formatDateTime } from "@/utils/formatters";
import { Download, ExternalLink, FileText, Printer } from "lucide-react";
import { Link } from "react-router";

export function ReportCard({ report }: { report: EvidenceReport }) {
  const integrityTone =
    report.integrity.mismatched > 0
      ? "border-jred/50 bg-jred/10 text-jred"
      : report.integrity.verified > 0
        ? "border-jgreen/50 bg-jgreen/10 text-jgreen"
        : "border-jcyan/50 bg-jcyan/10 text-jcyan";

  return (
    <article className="jaal-panel jaal-hud group flex flex-col gap-3 p-4 transition-colors hover:border-jcyan/50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] tracking-wider text-jcyan">
              {report.id}
            </span>
            <span className="border border-jborder/60 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-jmuted">
              {report.caseId}
            </span>
          </div>
          <h3 className="mt-1.5 truncate text-sm font-semibold text-jtext">
            {report.title}
          </h3>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-jmuted/70">
            generated {formatDateTime(report.generatedAt)} · {report.generatedBy}
          </p>
        </div>
        <FileText className="size-4 shrink-0 text-jmuted group-hover:text-jcyan" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone="border-jamber/50 bg-jamber/10 text-jamber">
          simulated report
        </Chip>
        <Chip tone={integrityTone}>
          {report.integrity.verified}/{report.evidenceCount} verified
          {report.integrity.mismatched > 0 && ` · ${report.integrity.mismatched} mismatch`}
        </Chip>
        <Chip tone="border-jborder/60 bg-jsurface text-jmuted">
          {report.evidenceCount} items
        </Chip>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-jborder/60 pt-3">
        <Link
          to={`/reports/${report.id}`}
          className="flex items-center gap-1.5 border border-jcyan/50 bg-jcyan/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-jcyan transition-colors hover:bg-jcyan/20"
        >
          <ExternalLink className="size-3" /> Open
        </Link>
        <button
          type="button"
          onClick={() => exportReportJson(report)}
          className="flex items-center gap-1.5 border border-jborder/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-jmuted transition-colors hover:border-jgreen/50 hover:text-jgreen"
          title="Download JSON"
        >
          <Download className="size-3" /> JSON
        </button>
        <button
          type="button"
          onClick={printReport}
          className="flex items-center gap-1.5 border border-jborder/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-jmuted transition-colors hover:border-jcyan/50 hover:text-jcyan"
          title="Print / save as PDF"
        >
          <Printer className="size-3" /> Print
        </button>
      </div>
    </article>
  );
}
