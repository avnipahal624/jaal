import { Chip, HASH_LABEL, HASH_TONE } from "@/components/ui/panel";
import { useJaal } from "@/state/JaalProvider";
import { exportReportJson, printReport } from "@/services/reportService";
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

function Section({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 break-inside-avoid">
      <div className="mb-2 flex items-center gap-2 border-b border-jborder/70 pb-1.5">
        <span className="font-mono text-xs font-semibold text-jcyan">{index}</span>
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-jtext">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

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

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      {/* Toolbar */}
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
        className="jaal-panel jaal-print-sheet relative p-5 sm:p-7"
      >
        {/* Report head */}
        <header className="border-b border-jborder/70 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="jaal-label">JAAL · evidence report</p>
              <h1 className="mt-1.5 text-xl font-bold leading-tight text-jtext sm:text-2xl">
                {report.title}
              </h1>
              <p className="mt-1 font-mono text-[11px] text-jmuted">
                {report.id} · case {report.caseId} · {report.category}
              </p>
            </div>
            <Chip tone="border-jamber/50 bg-jamber/10 text-jamber">
              simulated report
            </Chip>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Generated", formatDateTime(report.generatedAt)],
              ["Analyst", report.generatedBy],
              ["Evidence", String(report.evidenceCount)],
              ["Current stage", report.currentStage],
            ].map(([k, v]) => (
              <div key={k} className="border border-jborder/60 bg-jsurface/70 px-2.5 py-1.5">
                <dt className="jaal-label !text-[9px]">{k}</dt>
                <dd className="mt-0.5 truncate font-mono text-[11px] text-jtext">{v}</dd>
              </div>
            ))}
          </dl>
        </header>

        {/* 1 · Case summary */}
        <Section index="01" title="Case summary">
          <p className="text-[13px] leading-relaxed text-jtext/90">
            {report.description}
          </p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-jmuted">
            status {report.status} · simulated conversation · synthetic identifiers only
          </p>
        </Section>

        {/* 2 · Executive summary */}
        <Section index="02" title="Executive summary">
          <div className="space-y-1.5">
            <div className="border-l-2 border-jcyan/60 bg-jcyan/[0.05] px-2.5 py-1.5">
              <p className="jaal-label !text-[9px]">Claimed scam scenario</p>
              <p className="mt-1 text-[12px] leading-relaxed text-jtext/90">
                {report.summary.scenario || "—"}
              </p>
            </div>
            <div className="border-l-2 border-jamber/60 bg-jamber/[0.05] px-2.5 py-1.5">
              <p className="jaal-label !text-[9px]">Manipulation tactics</p>
              <p className="mt-1 text-[12px] leading-relaxed text-jtext/90">
                {report.summary.tactics || "—"}
              </p>
            </div>
            <div className="border-l-2 border-jred/60 bg-jred/[0.05] px-2.5 py-1.5">
              <p className="jaal-label !text-[9px]">Payment request details</p>
              <p className="mt-1 text-[12px] leading-relaxed text-jtext/90">
                {report.summary.payment || "—"}
              </p>
            </div>
          </div>
          {report.summary.moments.length > 0 && (
            <div className="mt-2">
              <p className="jaal-label !text-[9px] mb-1.5">Important moments</p>
              <ul className="space-y-1">
                {report.summary.moments.map((m, i) => (
                  <li
                    key={i}
                    className="border border-jborder/50 bg-jsurface px-2.5 py-1.5"
                  >
                    <p className="font-mono text-[9px] uppercase tracking-wider text-jamber">
                      {m.label} · {formatTime(m.timestamp)}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-jtext/85">
                      “{m.text}”
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* 3 · Unknowns */}
        <Section index="03" title="What we could not establish">
          {report.unknowns.length === 0 ? (
            <p className="text-xs text-jmuted">No gaps recorded.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-4 text-[12px] leading-relaxed text-jtext/90">
              {report.unknowns.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          )}
        </Section>

        {/* 4 · Transcript */}
        <Section index="04" title="Conversation transcript">
          {report.transcript.length === 0 ? (
            <p className="text-xs text-jmuted">No messages recorded.</p>
          ) : (
            <ul className="space-y-1.5">
              {report.transcript.map((m, i) => (
                <li
                  key={i}
                  className={`border-l-2 px-2.5 py-1.5 ${
                    m.author === "scammer"
                      ? "border-jred/60 bg-jred/[0.05]"
                      : m.author === "decoy"
                        ? "border-jcyan/60 bg-jcyan/[0.05]"
                        : "border-jborder bg-jsurface/60"
                  }`}
                >
                  <p className="font-mono text-[9px] uppercase tracking-widest text-jmuted">
                    {m.author} · {formatTime(m.timestamp)}
                  </p>
                  <p className="text-[12px] leading-relaxed text-jtext/90">{m.text}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* 5 · Tactic analysis */}
        <Section index="05" title="Scam tactic analysis">
          {report.tactics.length === 0 ? (
            <p className="text-xs text-jmuted">No tactics detected.</p>
          ) : (
            <div className="space-y-1.5">
              {report.tactics.map((t, i) => (
                <div key={i} className="border border-jborder/60 bg-jsurface/70 px-2.5 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold text-jamber">
                      {t.name}
                    </span>
                    <span className="font-mono text-[9px] text-jmuted">
                      {formatDateTime(t.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-jmuted">
                    {t.explanation}
                  </p>
                  <p className="mt-1 line-clamp-2 border-l-2 border-jborder/70 pl-2 text-[11px] text-jtext/80">
                    “{t.sourceText}”
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 6 · Kill-chain */}
        <Section index="06" title="Kill-chain progression">
          <ol className="space-y-1.5">
            {report.stages.map((s) => (
              <li
                key={s.id}
                className={`flex flex-wrap items-center gap-2 border px-2.5 py-1.5 ${
                  s.status === "active"
                    ? "border-jamber/50 bg-jamber/10"
                    : s.status === "pending"
                      ? "border-jborder/60 opacity-60"
                      : "border-jteal/40 bg-jteal/[0.07]"
                }`}
              >
                <span className="font-mono text-[11px] font-semibold text-jcyan">
                  0{s.number}
                </span>
                <span className="text-[12px] font-medium text-jtext">{s.label}</span>
                <Chip
                  tone={
                    s.status === "active"
                      ? "border-jamber/60 text-jamber"
                      : s.status === "pending"
                        ? "border-jborder text-jmuted"
                        : "border-jteal/50 text-jteal"
                  }
                  className="ml-auto"
                >
                  {s.status}
                </Chip>
                {s.detectedAt && (
                  <span className="w-full font-mono text-[9px] text-jmuted">
                    {formatDateTime(s.detectedAt)} — {s.reason}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Section>

        {/* 7 · Extracted identifiers */}
        <Section index="07" title="Extracted identifiers & hashes">
          {report.evidence.length === 0 ? (
            <p className="text-xs text-jmuted">No identifiers extracted.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-jborder/70">
                    {["Type", "Value", "Extracted", "SHA-256", "Status"].map((h) => (
                      <th
                        key={h}
                        className="jaal-label !text-[9px] whitespace-nowrap px-2 py-1.5"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.evidence.map((e) => (
                    <tr key={e.id} className="border-b border-jborder/40">
                      <td className="px-2 py-1.5 font-mono text-[10px] uppercase text-jmuted">
                        {e.label}
                      </td>
                      <td className="max-w-52 truncate px-2 py-1.5 font-mono text-[11px] text-jcyan">
                        {e.value}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[10px] text-jmuted">
                        {formatDateTime(e.extractedAt)}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[10px] text-jteal">
                        {e.hash ? shortHash(e.hash, 12) : "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        <Chip
                          tone={
                            HASH_TONE[e.hashStatus as keyof typeof HASH_TONE] ??
                              "border-jborder text-jmuted"
                          }
                        >
                          {HASH_LABEL[e.hashStatus as keyof typeof HASH_LABEL] ?? e.hashStatus}
                        </Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* 8 · Timeline */}
        <Section index="08" title="Investigation timeline">
          {report.timeline.length === 0 ? (
            <p className="text-xs text-jmuted">No timeline events.</p>
          ) : (
            <ul className="space-y-1">
              {report.timeline.map((t, i) => (
                <li key={i} className="flex gap-2 font-mono text-[10px] leading-relaxed">
                  <span className="shrink-0 text-jmuted/70">{formatTime(t.timestamp)}</span>
                  <span className="text-jcyan/70">{t.kind}</span>
                  <span className="text-jtext/85">{t.title}</span>
                  <span className="truncate text-jmuted">{t.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* 9 · Integrity */}
        <Section index="09" title="Integrity verification results">
          <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ["Collected", report.integrity.collected, "text-jcyan"],
              ["Hashed", report.integrity.hashed, "text-jteal"],
              ["Verified", report.integrity.verified, "text-jgreen"],
              ["Mismatched", report.integrity.mismatched, "text-jred"],
              ["Unhashed", report.integrity.unhashed, "text-jmuted"],
            ].map(([k, v, tone]) => (
              <div key={k as string} className="border border-jborder/60 bg-jsurface/70 px-2 py-1.5 text-center">
                <p className={`font-mono text-lg font-semibold ${tone}`}>{v}</p>
                <p className="jaal-label !text-[8px]">{k}</p>
              </div>
            ))}
          </div>
          <ul className="space-y-1">
            {report.verification.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2 px-0.5 text-[11px]">
                <Chip
                  tone={
                    HASH_TONE[v.status as keyof typeof HASH_TONE] ??
                      "border-jborder text-jmuted"
                  }
                >
                  {HASH_LABEL[v.status as keyof typeof HASH_LABEL] ?? v.status}
                </Chip>
                <span className="truncate font-mono text-[10px] text-jtext/85">
                  {v.label}
                </span>
                <span className="text-[10px] text-jmuted">{v.note}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 border border-jamber/40 bg-jamber/10 px-2.5 py-1.5 text-[10px] leading-relaxed text-jamber">
            A matching hash proves stored content is unchanged since recording.
            It does not prove an identifier is genuine, that any person committed
            a crime, or that this report is legally admissible.
          </p>
        </Section>

        {/* 10 · Notes */}
        <Section index="10" title="Analyst notes">
          <p className="text-[12px] leading-relaxed text-jtext/90">
            {report.analystNotes}
          </p>
        </Section>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-jborder/70 pt-3 font-mono text-[9px] uppercase tracking-widest text-jmuted/70">
          <span>JAAL · every message is a clue</span>
          <span>
            {report.id} · generated {formatDateTime(report.generatedAt)}
          </span>
        </footer>
      </motion.article>

      <p className="jaal-no-print mt-3 text-center text-[10px] text-jmuted/70">
        Use “Print / save PDF” and choose your browser’s save-as-PDF option.
      </p>
    </div>
  );
}
