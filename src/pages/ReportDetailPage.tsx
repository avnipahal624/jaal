import { Chip, HASH_LABEL, HASH_TONE } from "@/components/ui/panel";
import { useJaal } from "@/state/JaalProvider";
import { exportReportJson, printReport } from "@/services/reportService";
import type { EvidenceReport } from "@/types/report";
import { formatDateTime, formatTime } from "@/utils/formatters";
import { shortHash } from "@/utils/hash";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
  FileWarning,
  Printer,
} from "lucide-react";
import { Link, useParams } from "react-router";

/**
 * EVIDENCE REPORT — forensic case-file presentation.
 *
 * One markup, two skins: the rp-* design system in index.css renders the
 * dossier dark on screen and as a light, ink-friendly paper document in the
 * browser print/PDF output (accents carried by borders so meaning survives
 * with background graphics disabled). All content comes from the stored
 * report record — nothing here invents findings.
 */

function SectionHead({
  index,
  title,
  sub,
}: {
  index: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="rp-sec-head">
      <span className="rp-sec-idx">{index}</span>
      <h2 className="rp-sec-title">{title}</h2>
      {sub && <span className="rp-sec-sub">{sub}</span>}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  active: "border-jcyan/60 bg-jcyan/10 text-jcyan",
  completed: "border-jgreen/60 bg-jgreen/10 text-jgreen",
  archived: "border-jborder text-jmuted",
};

const VERDICT_TONE: Record<string, string> = {
  confirmed: "border-jgreen/60 bg-jgreen/10 text-jgreen",
  incorrect: "border-jred/60 bg-jred/10 text-jred",
  needs_review: "border-jamber/60 bg-jamber/10 text-jamber",
};

const VERDICT_LABEL: Record<string, string> = {
  confirmed: "confirmed",
  incorrect: "incorrect",
  needs_review: "needs review",
};

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state } = useJaal();
  const report = state.reports.find((r) => r.id === id);

  if (!report) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <FileWarning className="size-7 text-jmuted/60" />
        <p className="text-sm text-jmuted">Report not found in this session.</p>
        <Link
          to="/reports"
          className="border border-jcyan/50 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-jcyan transition-colors hover:bg-jcyan/10"
        >
          Back to reports
        </Link>
      </div>
    );
  }

  // Key findings — derived strictly from stored report data. Never invented.
  const tacticNames = Array.from(new Set(report.tactics.map((t) => t.name)));
  const keyFindings: { text: string; alert?: boolean }[] = [];
  if (report.integrity.verified > 0) {
    keyFindings.push({
      text: `${report.integrity.verified} of ${report.evidenceCount} preserved indicators integrity-verified — recomputed SHA-256 matches the recorded baseline.`,
    });
  }
  if (report.integrity.mismatched > 0) {
    keyFindings.push({
      text: `${report.integrity.mismatched} indicator${report.integrity.mismatched === 1 ? "" : "s"} FAILED integrity verification — stored content changed after recording. Treat as altered.`,
      alert: true,
    });
  }
  if (tacticNames.length > 0) {
    keyFindings.push({
      text: `${report.tactics.length} manipulation tactic detections across the conversation: ${tacticNames.join(", ")}.`,
    });
  }
  keyFindings.push({
    text: `Kill-chain reached: ${report.currentStage.toUpperCase()} · conversation recorded: ${report.transcript.length} messages · case status: ${report.status}.`,
  });
  const reviewedRows = report.evidence.filter((e) => e.review?.status);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      {/* Toolbar — screen only */}
      <div className="jaal-no-print mb-4 flex flex-wrap items-center gap-2">
        <Link
          to="/reports"
          className="flex items-center gap-1.5 border border-jborder/70 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-jmuted transition-colors hover:border-jcyan/50 hover:text-jcyan"
        >
          <ArrowLeft className="size-3" /> Reports
        </Link>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => exportReportJson(report)}
            className="flex items-center gap-1.5 border border-jgreen/50 bg-jgreen/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-jgreen transition-colors hover:bg-jgreen/20"
          >
            <Download className="size-3" /> Export JSON
          </button>
          <button
            type="button"
            onClick={printReport}
            className="flex items-center gap-1.5 border border-jcyan/50 bg-jcyan/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-jcyan transition-colors hover:bg-jcyan/20"
          >
            <Printer className="size-3" /> Print / save PDF
          </button>
        </div>
      </div>

      <motion.article
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rp-sheet p-5 sm:p-7"
      >
        {/* ======================= MASTHEAD ======================= */}
        <header className="rp-masthead">
          <div>
            <p className="rp-wordmark">JAAL</p>
            <p className="rp-doctype mt-0.5">Forensics console · evidence report</p>
          </div>
          <div className="text-right">
            <p className="rp-caseref">CASE / {report.caseId}</p>
            <p className="rp-doctype mt-0.5">
              {report.id} · generated {formatDateTime(report.generatedAt)}
            </p>
          </div>
        </header>
        <div className="rp-accent-rule" />

        {/* ======================= TITLE + STATUS ======================= */}
        <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
          <h1 className="max-w-2xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {report.title}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone={STATUS_TONE[report.status] ?? "border-jborder text-jmuted"}>
              {report.status}
            </Chip>
            {report.simulated && (
              <Chip tone="border-jamber/60 bg-jamber/10 text-jamber">
                simulated report
              </Chip>
            )}
            <Chip tone="border-jborder/60 text-jmuted">{report.category}</Chip>
          </div>
        </div>

        {/* ======================= METADATA STRIP ======================= */}
        <dl className="rp-meta mt-4">
          {[
            ["Case ID", report.caseId],
            ["Analyst", report.generatedBy],
            ["Generated", formatDateTime(report.generatedAt)],
            ["Stage", report.currentStage],
            ["Evidence", String(report.evidenceCount)],
          ].map(([k, v]) => (
            <div key={k} className="rp-meta-cell">
              <dt className="rp-label">{k}</dt>
              <dd className="rp-meta-value">{v}</dd>
            </div>
          ))}
        </dl>

        {/* ======================= 01 · CASE SUMMARY + KEY FINDINGS ======================= */}
        <section className="rp-sec">
          <SectionHead index="01" title="Case summary" sub="investigative briefing" />
          <div className="rp-brief">
            <p className="text-[13px] leading-relaxed">{report.description}</p>
            <p className="rp-label mt-1.5">
              status {report.status} · simulated conversation · synthetic identifiers only
            </p>
            <div className="rp-findings">
              <p className="rp-label !text-jcyan">Key findings</p>
              <ul className="mt-1">
                {keyFindings.map((f, i) => (
                  <li key={i} className={f.alert ? "rp-alert" : undefined}>
                    {f.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ======================= 02 · EXECUTIVE SUMMARY ======================= */}
        <section className="rp-sec">
          <SectionHead index="02" title="Executive summary" sub="engine-generated narrative" />
          <div className="space-y-2">
            <div className="rp-quote rp-decoy">
              <p className="rp-label !text-jteal">Claimed scam scenario</p>
              <p className="rp-quote-text">{report.summary.scenario || "—"}</p>
            </div>
            <div className="rp-quote">
              <p className="rp-label !text-jamber">Manipulation tactics</p>
              <p className="rp-quote-text">{report.summary.tactics || "—"}</p>
            </div>
            <div className="rp-quote">
              <p className="rp-label !text-jred">Payment request details</p>
              <p className="rp-quote-text">{report.summary.payment || "—"}</p>
            </div>
          </div>
          {report.summary.moments.length > 0 && (
            <div className="mt-3">
              <p className="rp-label mb-1.5">Important moments</p>
              <div className="space-y-2">
                {report.summary.moments.map((m, i) => (
                  <div key={i} className="rp-quote">
                    <p className="rp-mono text-[9px] uppercase tracking-[0.18em] text-jamber">
                      {m.label} · {formatTime(m.timestamp)}
                    </p>
                    <p className="rp-quote-text">“{m.text}”</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ======================= 03 · LIMITATIONS ======================= */}
        <section className="rp-sec">
          <SectionHead index="03" title="What we could not establish" sub="limitations" />
          {report.unknowns.length === 0 ? (
            <p className="text-xs opacity-70">No gaps recorded.</p>
          ) : (
            <ul className="rp-findings mt-0">
              {report.unknowns.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          )}
        </section>

        {/* ======================= 04 · TRANSCRIPT ======================= */}
        <section className="rp-sec">
          <SectionHead
            index="04"
            title="Conversation transcript"
            sub={`${report.transcript.length} recorded messages`}
          />
          {report.transcript.length === 0 ? (
            <p className="text-xs opacity-70">No messages recorded.</p>
          ) : (
            <div className="space-y-2">
              {report.transcript.map((m, i) => (
                <div
                  key={i}
                  className={`rp-quote ${m.author === "decoy" ? "rp-decoy" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rp-mono text-[9px] font-semibold uppercase tracking-[0.18em]">
                      MSG #{String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`rp-mono text-[9px] uppercase tracking-[0.18em] ${
                        m.author === "scammer" ? "text-jred" : "text-jteal"
                      }`}
                    >
                      {m.author === "scammer" ? "suspect" : m.author}
                    </span>
                    <span className="rp-mono text-[9px] opacity-60">
                      {formatTime(m.timestamp)}
                    </span>
                  </div>
                  <p className="rp-quote-text">{m.text}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ======================= 05 · TACTICS ======================= */}
        <section className="rp-sec">
          <SectionHead
            index="05"
            title="Scam tactic analysis"
            sub={`${report.tactics.length} detections · ${tacticNames.length} tactic types`}
          />
          {report.tactics.length === 0 ? (
            <p className="text-xs opacity-70">No tactics detected.</p>
          ) : (
            <div className="space-y-2">
              {report.tactics.map((t, i) => (
                <div key={i} className="rp-callout">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="border-jamber/50 bg-jamber/10 text-jamber">
                      {t.name}
                    </Chip>
                    {t.messageNumber != null && (
                      <span className="rp-mono text-[9px] uppercase tracking-[0.18em]">
                        source MSG #
                        {String(t.messageNumber).padStart(2, "0")}
                      </span>
                    )}
                    <span className="rp-mono text-[9px] opacity-60">
                      {formatDateTime(t.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed opacity-80">
                    {t.explanation}
                  </p>
                  <p className="mt-1 border-l-2 border-jborder/70 pl-2 text-[12px] leading-relaxed">
                    “{t.sourceText}”
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ======================= 06 · KILL-CHAIN ======================= */}
        <section className="rp-sec">
          <SectionHead index="06" title="Kill-chain progression" sub="content-derived stages" />
          <ol className="space-y-1.5">
            {report.stages.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-2 border border-jborder/60 px-2.5 py-1.5"
              >
                <span className="rp-mono text-[11px] font-semibold">
                  0{s.number}
                </span>
                <span className="text-[12px] font-medium">{s.label}</span>
                <Chip
                  tone={
                    s.status === "active"
                      ? "border-jamber/60 bg-jamber/10 text-jamber"
                      : s.status === "pending"
                        ? "border-jborder text-jmuted"
                        : "border-jteal/50 bg-jteal/10 text-jteal"
                  }
                  className="ml-auto"
                >
                  {s.status}
                </Chip>
                {s.detectedAt && (
                  <span className="rp-mono w-full text-[9px] opacity-70">
                    {formatDateTime(s.detectedAt)} — {s.reason}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* ======================= 07 · INDICATORS ======================= */}
        <section className="rp-sec">
          <SectionHead
            index="07"
            title="Extracted identifiers & hashes"
            sub={`${report.evidence.length} items · sha-256`}
          />
          {report.evidence.length === 0 ? (
            <p className="text-xs opacity-70">No identifiers extracted.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="rp-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Value</th>
                    <th>Source</th>
                    <th>Extracted</th>
                    <th>SHA-256</th>
                    <th>Status / review</th>
                  </tr>
                </thead>
                <tbody>
                  {report.evidence.map((e) => (
                    <tr key={e.id}>
                      <td className="rp-mono text-[10px] uppercase">
                        {e.label}
                      </td>
                      <td className="rp-value">{e.value}</td>
                      <td className="rp-mono whitespace-nowrap text-[10px] opacity-80">
                        {e.sourceMessageNumber != null
                          ? `MSG #${String(e.sourceMessageNumber).padStart(2, "0")}`
                          : "—"}
                      </td>
                      <td className="rp-mono whitespace-nowrap text-[10px] opacity-70">
                        {formatDateTime(e.extractedAt)}
                      </td>
                      <td className="rp-mono text-[10px]">
                        {e.hash ? shortHash(e.hash, 12) : "—"}
                      </td>
                      <td>
                        <span className="flex flex-wrap items-center gap-1">
                          <Chip
                            tone={
                              HASH_TONE[e.hashStatus as keyof typeof HASH_TONE] ??
                                "border-jborder text-jmuted"
                            }
                          >
                            {HASH_LABEL[e.hashStatus as keyof typeof HASH_LABEL] ??
                              e.hashStatus}
                          </Chip>
                          {e.review?.status && (
                            <Chip
                              tone={
                                VERDICT_TONE[e.review.status] ??
                                "border-jborder text-jmuted"
                              }
                            >
                              {VERDICT_LABEL[e.review.status] ?? e.review.status}
                            </Chip>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Analyst verdicts — original findings stay visible above */}
          {reviewedRows.length > 0 && (
            <div className="mt-3 border border-jborder/60 p-3">
              <p className="rp-label !text-jteal">Analyst verdicts</p>
              <div className="mt-1.5 space-y-1.5">
                {reviewedRows.map((e) => (
                  <div
                    key={e.id}
                    className="flex flex-wrap items-baseline gap-2 border-l-2 border-jteal/60 pl-2.5"
                  >
                    <span className="rp-mono text-[11px]">{e.value}</span>
                    <Chip
                      tone={
                        VERDICT_TONE[e.review!.status!] ??
                        "border-jborder text-jmuted"
                      }
                    >
                      {VERDICT_LABEL[e.review!.status!] ?? e.review!.status}
                    </Chip>
                    {e.review!.note && (
                      <span className="text-[11px] leading-relaxed opacity-80">
                        {e.review!.note}
                      </span>
                    )}
                    {e.review!.reviewedAt && (
                      <span className="rp-mono text-[9px] opacity-60">
                        {formatDateTime(e.review!.reviewedAt)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ======================= 08 · TIMELINE ======================= */}
        <section className="rp-sec">
          <SectionHead
            index="08"
            title="Investigation timeline"
            sub={`${report.timeline.length} events`}
          />
          {report.timeline.length === 0 ? (
            <p className="text-xs opacity-70">No timeline events.</p>
          ) : (
            <ul className="space-y-1">
              {report.timeline.map((t, i) => (
                <li
                  key={i}
                  className="flex gap-2 rp-mono text-[10px] leading-relaxed"
                >
                  <span className="shrink-0 opacity-60">
                    {formatTime(t.timestamp)}
                  </span>
                  <span className="shrink-0">{t.kind}</span>
                  <span className="font-semibold">{t.title}</span>
                  <span className="truncate opacity-70">{t.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ======================= 09 · INTEGRITY ======================= */}
        <section className="rp-sec">
          <SectionHead
            index="09"
            title="Evidence integrity"
            sub="sha-256 · web crypto"
          />
          <div className="rp-integrity-grid">
            {[
              ["Collected", report.integrity.collected, ""],
              ["Hash generated", report.integrity.hashed, ""],
              ["Verified", report.integrity.verified, "text-jgreen"],
              ["Mismatch", report.integrity.mismatched, "text-jred"],
              ["Not hashed", report.integrity.unhashed, "text-jamber"],
            ].map(([k, v, tone]) => (
              <div key={k as string} className="rp-state">
                <p className={`rp-state-num ${tone}`}>{v}</p>
                <p className="rp-state-label">{k}</p>
              </div>
            ))}
          </div>
          <p className="rp-mono mt-2 text-[9px] leading-relaxed opacity-70">
            Verified = recomputed content hash matches the recorded baseline. A
            hash merely existing (HASH GENERATED) is NOT a verified state.
          </p>
          <ul className="mt-2 space-y-1">
            {report.verification.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center gap-2 border border-jborder/50 px-2 py-1"
              >
                <Chip
                  tone={
                    HASH_TONE[v.status as keyof typeof HASH_TONE] ??
                      "border-jborder text-jmuted"
                  }
                >
                  {HASH_LABEL[v.status as keyof typeof HASH_LABEL] ?? v.status}
                </Chip>
                <span className="rp-mono text-[10px]">{v.label}</span>
                <span className="text-[10px] opacity-70">{v.note}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 border-l-[3px] border-jamber px-2.5 py-1.5 text-[10.5px] leading-relaxed">
            A matching hash proves stored content is unchanged since recording.
            It does not prove an identifier is genuine, that any person
            committed a crime, or that this report is legally admissible.
          </p>
        </section>

        {/* ======================= 10 · ANALYST NOTES ======================= */}
        <section className="rp-sec">
          <SectionHead index="10" title="Analyst notes" />
          <p className="text-[12.5px] leading-relaxed">{report.analystNotes}</p>
        </section>

        {/* Footer */}
        <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-jborder/70 pt-3 rp-mono text-[9px] uppercase tracking-[0.2em] opacity-70">
          <span>JAAL · every message is a clue</span>
          <span>
            {report.id} · generated {formatDateTime(report.generatedAt)}
          </span>
        </footer>

        {/* Print-only running footer — repeats per page in Chromium print */}
        <div className="rp-runfoot">
          <span>JAAL forensics console · evidence report</span>
          <span>
            case {report.caseId} · {report.id}
          </span>
          <span>simulated report — synthetic identifiers</span>
        </div>
      </motion.article>

      <p className="jaal-no-print mt-3 text-center text-[10px] text-jmuted/70">
        Use “Print / save PDF” and choose your browser’s save-as-PDF option.
      </p>
    </div>
  );
}
