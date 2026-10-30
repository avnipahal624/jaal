import { useJaal } from "@/state/JaalProvider";
import { exportReportJson, printReport } from "@/services/reportService";
import {
  indicatorAccent,
  integrityKey,
  invKey,
  paperStyle,
  reviewKey,
} from "@/theme/status";
import { formatDateTime, formatTime } from "@/utils/formatters";
import { shortHash } from "@/utils/hash";
import { motion } from "framer-motion";
import { ArrowLeft, Download, FileWarning, Printer } from "lucide-react";
import { Link, useParams } from "react-router";

/**
 * EVIDENCE REPORT — warm archival-paper case file.
 *
 * Editorial dossier presentation: serif display type, ink rules and stamps,
 * marginal source references, evidence numbering (EV-01…), and one documented
 * exhibit on the cover — always real report data, never invented. Structure is
 * carried by ink borders and text, so the PDF stays readable with browser
 * background graphics disabled.
 */

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

/** Hash lifecycle → stamp (text always present; color from the shared map). */
const INTEGRITY_LABEL: Record<string, string> = {
  INTEGRITY_VERIFIED: "Verified",
  HASH_MISMATCH: "Hash mismatch",
  HASH_GENERATED: "Hash on file",
  NOT_HASHED: "Unhashed",
  // Frontend-normalized aliases (older stored reports)
  verified: "Verified",
  mismatch: "Hash mismatch",
  generated: "Hash on file",
  none: "Unhashed",
};

const VERDICT_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  incorrect: "Incorrect",
  needs_review: "Needs review",
};

function Stamp({
  style,
  label,
  small = true,
}: {
  style: { color: string; borderColor: string };
  label: string;
  small?: boolean;
}) {
  return (
    <span className={`df-stamp${small ? " df-stamp-sm" : ""}`} style={style}>
      {label}
    </span>
  );
}

function SectionHead({
  num,
  title,
  deck,
}: {
  num: string;
  title: string;
  deck?: string;
}) {
  return (
    <div className="df-sechead">
      <span className="df-secnum">{num}</span>
      <h2 className="df-sectitle">{title}</h2>
      {deck && <p className="df-secdeck">{deck}</p>}
    </div>
  );
}

const evRef = (index: number) => `EV-${String(index + 1).padStart(2, "0")}`;
const msgRef = (n: number | null | undefined) =>
  n != null ? `MSG #${String(n).padStart(2, "0")}` : null;

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

  // ---- Cover exhibit: a single documented fragment, strictly real data ----
  const exhibitEvidence =
    report.evidence.find((e) => e.type === "payment_request") ??
    report.evidence[0] ??
    null;
  const exhibitMessage =
    report.transcript.find((m) => m.author === "scammer") ?? null;
  const exhibitIndex = exhibitEvidence
    ? report.evidence.indexOf(exhibitEvidence)
    : -1;

  // Key findings — derived strictly from stored report data.
  const tacticNames = Array.from(new Set(report.tactics.map((t) => t.name)));
  const findings: { text: string; alert?: boolean }[] = [];
  if (report.integrity.verified > 0) {
    findings.push({
      text: `${report.integrity.verified} of ${report.evidenceCount} preserved indicators integrity-verified — recomputed SHA-256 matches the recorded baseline.`,
    });
  }
  if (report.integrity.mismatched > 0) {
    findings.push({
      text: `${report.integrity.mismatched} indicator${report.integrity.mismatched === 1 ? "" : "s"} failed integrity verification — stored content changed after recording. Treat as altered.`,
      alert: true,
    });
  }
  if (tacticNames.length > 0) {
    findings.push({
      text: `${report.tactics.length} manipulation tactic detections across the conversation: ${tacticNames.join(", ")}.`,
    });
  }
  findings.push({
    text: `Kill-chain reached ${report.currentStage.toUpperCase()} across ${report.transcript.length} recorded messages; case status ${report.status}.`,
  });

  const reviewedRows = report.evidence
    .map((e, i) => ({ row: e, num: evRef(i) }))
    .filter((x) => x.row.review?.status);

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
        className="df-sheet px-6 py-8 sm:px-12 sm:py-12"
      >
        <div className="df-grain" aria-hidden />

        {/* ======================= COVER ======================= */}
        <section className="df-cover relative">
          {/* Identity row */}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="df-serif text-lg font-bold tracking-[0.2em] text-[color:var(--navy)]">
              JAAL
            </p>
            <p className="df-kicker">Forensics / case file</p>
            <p className="df-mono text-[10px] tracking-[0.14em] text-[color:var(--ink-soft)]">
              {new Date(report.generatedAt).toISOString().slice(0, 10)}
            </p>
          </div>
          <hr className="df-rule-strong mt-3" />

          {/* Case number */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="df-caseno">
              CASE NO. {report.caseId}
              {report.reportVersion ? (
                <span className="df-mono ml-3 text-[12px] text-[color:var(--ink-soft)]">
                  report v{report.reportVersion}
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Stamp
                small={false}
                style={paperStyle("inv", invKey(report.status))}
                label={STATUS_LABEL[report.status] ?? report.status}
              />
              {report.simulated && (
                <Stamp
                  small={false}
                  style={paperStyle("engine", "simulation")}
                  label="Simulated"
                />
              )}
            </div>
          </div>

          {/* Editorial title */}
          <h1 className="df-title mt-4">{report.title}</h1>
          <p className="mt-3 text-[13px] italic text-[color:var(--ink-soft)] df-serif">
            {report.category} — prepared by {report.generatedBy}
          </p>

          {/* Exhibit — one documented fragment from the actual case */}
          {(exhibitEvidence || exhibitMessage) && (
            <div className="df-exhibit mt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="df-kicker !text-[color:var(--navy)]">
                  Exhibit A
                </p>
                <p className="df-margref">
                  {exhibitEvidence
                    ? `${evRef(exhibitIndex)} · ${exhibitEvidence.label}`
                    : "source message"}
                </p>
              </div>
              {exhibitEvidence ? (
                <>
                  <p className="df-exhibit-value mt-2">
                    {exhibitEvidence.value}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="df-margref">
                      {msgRef(exhibitEvidence.sourceMessageNumber) ??
                        "source not linked"}
                    </span>
                    <span className="df-margref">
                      extracted {formatDateTime(exhibitEvidence.extractedAt)}
                    </span>
                    <Stamp
                      style={paperStyle(
                        "integrity",
                        integrityKey(exhibitEvidence.hashStatus),
                      )}
                      label={
                        INTEGRITY_LABEL[exhibitEvidence.hashStatus] ??
                        exhibitEvidence.hashStatus
                      }
                    />
                    {exhibitEvidence.review?.status && (
                      <Stamp
                        style={paperStyle(
                          "review",
                          reviewKey(exhibitEvidence.review.status)!,
                        )}
                        label={
                          VERDICT_LABEL[exhibitEvidence.review.status] ??
                          exhibitEvidence.review.status
                        }
                      />
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="df-serif mt-2 text-[17px] italic leading-relaxed text-[color:var(--navy)]">
                    “{exhibitMessage!.text}”
                  </p>
                  <p className="df-margref mt-2">
                    {msgRef(
                      report.transcript.indexOf(exhibitMessage!) + 1,
                    )}{" "}
                    · suspect · {formatTime(exhibitMessage!.timestamp)}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Editorial metadata block */}
          <div className="df-metagrid mt-8">
            {[
              ["Analyst", report.generatedBy],
              ["Stage reached", report.currentStage],
              ["Evidence items", String(report.evidenceCount)],
              ["Generated", formatDateTime(report.generatedAt)],
            ].map(([k, v]) => (
              <div key={k} className="df-metacell">
                <p className="df-metalabel">{k}</p>
                <p className="df-metavalue">{v}</p>
              </div>
            ))}
          </div>
          <p className="df-margref mt-4">
            {report.id} · this document reflects a controlled simulation;
            identifiers are synthetic
          </p>
        </section>

        {/* ======================= 01 · CASE SUMMARY ======================= */}
        <section className="df-sec">
          <SectionHead
            num="01"
            title="Case summary"
            deck="what this investigation examined, and what it established"
          />
          <div className="df-secbody-underline">
            <p className="df-serif text-[15px] leading-[1.7]">
              {report.description}
            </p>
            <div className="mt-6">
              <p className="df-kicker !text-[color:var(--navy)]">Key findings</p>
              <ol className="mt-3 space-y-3">
                {findings.map((f, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="df-mono shrink-0 text-[11px] font-bold text-[color:var(--teal)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`text-[13px] leading-relaxed ${
                        f.alert ? "text-[color:var(--rust)]" : ""
                      }`}
                    >
                      {f.text}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ======================= 02 · EXECUTIVE SUMMARY ======================= */}
        <section className="df-sec">
          <SectionHead
            num="02"
            title="Executive summary"
            deck="scenario narrative beside the pressure pattern it reveals"
          />
          <div className="df-secbody-underline df-cols df-cols-wide-left">
            <div>
              <p className="df-kicker">Claimed scenario</p>
              <p className="mt-2 text-[13.5px] leading-[1.7]">
                {report.summary.scenario || "—"}
              </p>
              {report.summary.moments.length > 0 && (
                <div className="mt-5">
                  <p className="df-kicker">Important moments</p>
                  {report.summary.moments.map((m, i) => (
                    <div key={i} className="df-pull">
                      <p className="df-pull-text">“{m.text}”</p>
                      <p className="df-margref mt-1.5">
                        {m.label} · {formatTime(m.timestamp)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="border-t-2 border-[color:var(--navy)] pt-2">
                <p className="df-kicker">Manipulation tactics</p>
                <p className="mt-2 text-[13px] leading-relaxed">
                  {report.summary.tactics || "—"}
                </p>
              </div>
              <div className="mt-5 border-t-2 border-[color:var(--rust)] pt-2">
                <p className="df-kicker">Payment pressure</p>
                <p className="mt-2 text-[13px] leading-relaxed">
                  {report.summary.payment || "—"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ======================= 03 · LIMITATIONS ======================= */}
        <section className="df-sec">
          <SectionHead
            num="03"
            title="What we could not establish"
            deck="honest limits of this investigation"
          />
          <div className="df-secbody-underline">
            {report.unknowns.length === 0 ? (
              <p className="text-[13px]">No gaps recorded.</p>
            ) : (
              <ul className="space-y-2">
                {report.unknowns.map((u, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="df-mono shrink-0 text-[12px] text-[color:var(--ink-soft)]">
                      —
                    </span>
                    <span className="text-[13px] leading-relaxed">{u}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Provenance — every statement class kept explicitly separate */}
            {report.provenance && (
              <div className="mt-6 grid gap-5 border-t border-[color:var(--navy)]/30 pt-4 sm:grid-cols-2">
                <div>
                  <p className="df-kicker">Original conversation evidence</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed">
                    {report.provenance.conversation}
                  </p>
                  <p className="df-kicker mt-4">Rule-based findings</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {report.provenance.ruleBased.map((x, i) => (
                      <li key={i} className="text-[13px] leading-relaxed">
                        · {x}
                      </li>
                    ))}
                  </ul>
                  <p className="df-kicker mt-4">AI-assisted interpretations</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {report.provenance.aiAssisted.map((x, i) => (
                      <li key={i} className="text-[13px] leading-relaxed">
                        · {x}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="df-kicker">Human-reviewed findings</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {report.provenance.humanReviewed.map((x, i) => (
                      <li key={i} className="text-[13px] leading-relaxed">
                        · {x}
                      </li>
                    ))}
                  </ul>
                  <p className="df-kicker mt-4">Unverified assumptions</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {report.provenance.unverifiedAssumptions.map((x, i) => (
                      <li key={i} className="text-[13px] leading-relaxed">
                        · {x}
                      </li>
                    ))}
                  </ul>
                  <p className="df-kicker mt-4">Simulation-only content</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {report.provenance.simulationOnly.map((x, i) => (
                      <li key={i} className="text-[13px] leading-relaxed">
                        · {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ======================= 04 · TRANSCRIPT ======================= */}
        <section className="df-sec">
          <SectionHead
            num="04"
            title="Conversation transcript"
            deck={`${report.transcript.length} recorded messages, verbatim`}
          />
          <div className="df-secbody-underline">
            {report.transcript.length === 0 ? (
              <p className="text-[13px]">No messages recorded.</p>
            ) : (
              <div className="space-y-1">
                {report.transcript.map((m, i) => (
                  <div
                    key={i}
                    className={`df-frag ${
                      m.author === "decoy" ? "df-decoy" : ""
                    }`}
                  >
                    <p className="df-frag-meta">
                      {msgRef(i + 1)} ·{" "}
                      {m.author === "scammer" ? "suspect" : m.author} ·{" "}
                      {formatTime(m.timestamp)}
                    </p>
                    <p className="df-frag-text">{m.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ======================= 05 · TACTICS ======================= */}
        <section className="df-sec">
          <SectionHead
            num="05"
            title="Scam tactic analysis"
            deck={`${report.tactics.length} detections · ${tacticNames.length} tactic types`}
          />
          <div className="df-secbody-underline">
            {report.tactics.length === 0 ? (
              <p className="text-[13px]">No tactics detected.</p>
            ) : (
              report.tactics.map((t, i) => (
                <div key={i} className="df-item">
                  <div>
                    <p className="df-serif text-[15px] font-bold text-[color:var(--navy)]">
                      {t.name}
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-[color:var(--ink-soft)]">
                      {t.explanation}
                    </p>
                    <p className="mt-1.5 border-l-2 border-[color:var(--amber)] pl-3 text-[13px] leading-relaxed">
                      “{t.sourceText}”
                    </p>
                  </div>
                  <div className="df-margref">
                    <p>
                      {msgRef(t.messageNumber) ?? "source not linked"}
                    </p>
                    <p className="mt-0.5">{formatTime(t.timestamp)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ======================= 06 · KILL-CHAIN ======================= */}
        <section className="df-sec">
          <SectionHead
            num="06"
            title="Kill-chain progression"
            deck="stages evidenced by message content, not by clock or percentage"
          />
          <div className="df-secbody-underline">
            {report.stages.map((s) => (
              <div key={s.id} className="df-item">
                <div className="flex gap-4">
                  <span className="df-serif shrink-0 text-[26px] font-bold leading-none text-[color:var(--rule)]">
                    0{s.number}
                  </span>
                  <div>
                    <p className="df-serif text-[15px] font-bold text-[color:var(--navy)]">
                      {s.label}
                    </p>
                    {s.detectedAt && (
                      <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--ink-soft)]">
                        {formatDateTime(s.detectedAt)} — {s.reason}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={`df-stamp df-stamp-sm ${
                    s.status === "active"
                      ? "df-stamp-amber"
                      : s.status === "pending"
                        ? ""
                        : "df-stamp-teal"
                  }`}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ======================= 07 · EVIDENCE ======================= */}
        <section className="df-sec">
          <SectionHead
            num="07"
            title="Extracted identifiers & evidence"
            deck={`${report.evidence.length} documented items · SHA-256 recorded at extraction`}
          />
          <div className="df-secbody-underline">
            {report.evidence.length === 0 ? (
              <p className="text-[13px]">No identifiers extracted.</p>
            ) : (
              report.evidence.map((e, i) => (
                <div
                  key={e.id}
                  className="df-evidence"
                  style={{
                    borderLeft: `3px solid ${indicatorAccent(e.type)}`,
                    paddingLeft: 12,
                  }}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p>
                      <span className="df-evnum">{evRef(i)}</span>
                      <span className="df-kicker ml-3">{e.label}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Stamp
                        style={paperStyle(
                          "integrity",
                          integrityKey(e.hashStatus),
                        )}
                        label={
                          INTEGRITY_LABEL[e.hashStatus] ?? e.hashStatus
                        }
                      />
                      {e.review?.status && (
                        <Stamp
                          style={paperStyle(
                            "review",
                            reviewKey(e.review.status)!,
                          )}
                          label={
                            VERDICT_LABEL[e.review.status] ?? e.review.status
                          }
                        />
                      )}
                    </div>
                  </div>
                  <p className="df-mono mt-1.5 text-[14px] font-semibold text-[color:var(--navy)]">
                    {e.value}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
                    <span className="df-margref">
                      {msgRef(e.sourceMessageNumber) ?? "source not linked"}
                    </span>
                    <span className="df-margref">
                      extracted {formatDateTime(e.extractedAt)}
                    </span>
                  </div>
                  <p className="df-hash mt-1">
                    sha-256 {e.hash ? shortHash(e.hash, 24) : "not recorded"}
                  </p>
                  {e.review?.note && (
                    <p className="df-annotation mt-2 text-[12.5px]">
                      {e.review.note}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* ======================= 08 · TIMELINE ======================= */}
        <section className="df-sec">
          <SectionHead
            num="08"
            title="Investigation timeline"
            deck={`${report.timeline.length} recorded events`}
          />
          <div className="df-secbody-underline">
            {report.timeline.length === 0 ? (
              <p className="text-[13px]">No timeline events.</p>
            ) : (
              <ul>
                {report.timeline.map((t, i) => (
                  <li
                    key={i}
                    className="df-item !border-t-[0.5px] !py-1.5 df-mono text-[10.5px] leading-relaxed"
                  >
                    <div className="flex flex-wrap gap-x-3">
                      <span className="text-[color:var(--ink-soft)]">
                        {formatTime(t.timestamp)}
                      </span>
                      <span className="font-semibold">{t.title}</span>
                      <span className="text-[color:var(--ink-soft)]">
                        {t.detail}
                      </span>
                    </div>
                    <span className="df-margref">{t.kind}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ======================= 09 · INTEGRITY ======================= */}
        <section className="df-sec">
          <SectionHead
            num="09"
            title="Evidence integrity"
            deck="SHA-256 recorded at extraction · verified against the recorded baseline"
          />
          <div className="df-secbody-underline">
            <div className="df-counts">
              {[
                ["Collected", report.integrity.collected, ""],
                ["Hash on file", report.integrity.hashed, ""],
                ["Verified", report.integrity.verified, "verified"],
                ["Mismatch", report.integrity.mismatched, "mismatch"],
                ["Unhashed", report.integrity.unhashed, ""],
              ].map(([k, v, tone]) => (
                <div key={k as string} className="df-count">
                  <p
                    className="df-count-num"
                    style={
                      tone
                        ? paperStyle("integrity", tone as string)
                        : undefined
                    }
                  >
                    {v}
                  </p>
                  <p className="df-count-label">{k}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-[color:var(--ink-soft)]">
              Verified means the recomputed content hash matches the recorded
              baseline. A hash merely existing (“hash on file”) is not a
              verified state.
            </p>
            <p className="df-mono mt-1 text-[11px] text-[color:var(--ink-soft)]">
              algorithm · {report.hashAlgorithm ?? "SHA-256"} · generated{" "}
              {formatDateTime(report.generatedAt)}
            </p>

            <ul className="mt-4">
              {report.verification.map((v, i) => (
                <li key={v.id} className="df-item !py-2">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="df-evnum">{evRef(i)}</span>
                    <Stamp
                      style={paperStyle("integrity", integrityKey(v.status))}
                      label={INTEGRITY_LABEL[v.status] ?? v.status}
                    />
                    <span className="df-mono text-[11px]">{v.label}</span>
                    <span className="text-[11.5px] text-[color:var(--ink-soft)]">
                      {v.note}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {reviewedRows.length > 0 && (
              <div className="mt-5">
                <p className="df-kicker !text-[color:var(--navy)]">
                  Analyst verdicts
                </p>
                <div className="mt-2">
                  {reviewedRows.map(({ row, num }) => (
                    <div key={row.id} className="df-item !py-2">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="df-evnum">{num}</span>
                        <Stamp
                          style={paperStyle(
                            "review",
                            reviewKey(row.review!.status!)!,
                          )}
                          label={
                            VERDICT_LABEL[row.review!.status!] ??
                            row.review!.status!
                          }
                        />
                        <span className="df-mono text-[11px]">{row.value}</span>
                        {row.review!.note && (
                          <span className="text-[11.5px] italic text-[color:var(--ink-soft)]">
                            {row.review!.note}
                          </span>
                        )}
                      </div>
                      {row.review!.reviewedAt && (
                        <span className="df-margref">
                          {formatDateTime(row.review!.reviewedAt)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="df-disclaimer mt-5">
              A matching hash proves stored content is unchanged since
              recording. It does not prove an identifier is genuine, that any
              person committed a crime, or that this report is legally
              admissible. Every identifier in this file is synthetic demo
              material from a controlled simulation.
            </p>
          </div>
        </section>

        {/* ======================= 10 · ANALYST NOTES ======================= */}
        <section className="df-sec">
          <SectionHead num="10" title="Analyst notes" />
          <div className="df-secbody-underline">
            <p className="df-annotation">{report.analystNotes}</p>
            <p className="df-margref mt-2 text-right">
              — {report.generatedBy}, analyst of record
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-10">
          <hr className="df-rule" />
          <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2">
            <p className="df-kicker">JAAL · every message is a clue</p>
            <p className="df-margref">
              {report.id} · case {report.caseId} · generated{" "}
              {formatDateTime(report.generatedAt)}
            </p>
          </div>
        </footer>

        {/* Print-only running footer — repeats per page in Chromium */}
        <div className="df-runfoot">
          <span>JAAL forensics · case {report.caseId}</span>
          <span>{report.id}</span>
          <span>simulated case file — synthetic identifiers</span>
        </div>
      </motion.article>

      <p className="jaal-no-print mt-3 text-center text-[10px] text-jmuted/70">
        Use “Print / save PDF” and choose your browser’s save-as-PDF option.
      </p>
    </div>
  );
}
