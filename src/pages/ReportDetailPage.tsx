import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useJaal } from "@/state/JaalProvider";
import { exportReportJson, printReport } from "@/services/reportService";
import {
  indicatorAccent,
  integrityKey,
  invKey,
  reviewKey,
  STATUS_SCREEN,
} from "@/theme/status";
import {
  formatDateTime,
  formatElapsed,
  formatTime,
  maskValue,
  pluralize,
} from "@/utils/formatters";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
  FileText,
  FileWarning,
  Printer,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router";

/**
 * DIGITAL FORENSIC REPORT — dark forensic intelligence dossier.
 *
 * Native JAAL console surface: deep navy ground, thin cyan rules, mono
 * technical metadata and compact status stamps. Structure is carried by
 * borders, rules and label text — never by background colour alone — so the
 * screen and the printed PDF share one identity and the PDF still reads with
 * browser "background graphics" disabled.
 *
 * Every value rendered here comes from the stored report or from a live,
 * ownership-scoped AI query for this case. Sections with no data say so
 * instead of inventing content.
 */

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

type StampStyle = {
  color: string;
  backgroundColor: string;
  borderColor: string;
};

const FALLBACK_STAMP: StampStyle = {
  color: "#7899a9",
  backgroundColor: "transparent",
  borderColor: "#174451",
};

/**
 * Status stamp colours read straight from the shared screen palette.
 *
 * The report uses the screen hexes directly rather than the `--st-*` custom
 * properties: those flip to the paper palette inside `@media print`, which was
 * tuned for a light sheet and would fall below contrast on this dark one.
 */
function stamp(group: keyof typeof STATUS_SCREEN, key: string): StampStyle {
  const groupMap = STATUS_SCREEN[group] as Record<
    string,
    { text: string; bg: string; border: string }
  >;
  const c = groupMap[key];
  return c
    ? { color: c.text, backgroundColor: c.bg, borderColor: c.border }
    : FALLBACK_STAMP;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

/** Hash lifecycle → label. "stored" is never allowed to read as "verified". */
const INTEGRITY_LABEL: Record<string, string> = {
  INTEGRITY_VERIFIED: "Verified",
  HASH_MISMATCH: "Hash mismatch",
  HASH_GENERATED: "Hash stored",
  NOT_HASHED: "Not hashed",
  tampered: "Tampered",
  // Frontend-normalized aliases (older stored reports)
  verified: "Verified",
  mismatch: "Hash mismatch",
  generated: "Hash stored",
  none: "Not hashed",
};

/** What verification actually means for a stored-but-unverified baseline.
 *  Keys match `integrityKey()` output so no state falls through a gap. */
const VERIFICATION_NOTE: Record<string, string> = {
  verified: "Recomputed digest matches the recorded baseline.",
  mismatch: "Recomputed digest differs from the recorded baseline.",
  tampered: "Altered through the tamper simulation — re-run verification to confirm.",
  generated: "Baseline recorded — independently verified: NO.",
  nothashed: "No baseline recorded — independently verified: NO.",
};

const VERDICT_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  incorrect: "Incorrect",
  needs_review: "Needs review",
};

/** Severity grades — one colour per grade, never the same colour twice. */
const SEVERITY_CLASS: Record<string, string> = {
  CRITICAL: "df-sev-critical",
  HIGH: "df-sev-high",
  MEDIUM: "df-sev-medium",
  LOW: "df-sev-low",
};

function sevClass(raw: string | undefined): string {
  return SEVERITY_CLASS[(raw ?? "").toUpperCase()] ?? "df-sev-none";
}

const CONFIDENCE_CLASS: Record<string, string> = {
  high: "text-jgreen",
  medium: "text-jamber",
  low: "text-jmuted",
};

/**
 * Provenance tags — §10 requires these five classes to stay visibly distinct
 * so an AI prediction can never be read as something that happened.
 */
const PROVENANCE = {
  fact: {
    label: "Observed fact",
    cls: "border-jcyan/50 bg-jcyan/5 text-jcyan",
  },
  rule: {
    label: "Rule-based detection",
    cls: "border-jteal/60 bg-jteal/10 text-jteal",
  },
  ai: {
    label: "AI interpretation",
    cls: "border-jamber/50 bg-jamber/5 text-jamber",
  },
  prediction: {
    label: "AI prediction",
    cls: "border-jamber/60 bg-jamber/10 text-jamber",
  },
  confirmed: {
    label: "Investigator-confirmed finding",
    cls: "border-jgreen/50 bg-jgreen/5 text-jgreen",
  },
  pending: {
    label: "Awaiting investigator review",
    cls: "border-jborder/80 bg-jsurface/70 text-jmuted",
  },
  unavailable: {
    label: "Not generated",
    cls: "border-jborder/80 bg-jsurface/70 text-jmuted",
  },
  simulation: {
    label: "Simulation content",
    cls: "border-jred/40 bg-jred/5 text-jred",
  },
} as const;

function Tag({ kind }: { kind: keyof typeof PROVENANCE }) {
  const t = PROVENANCE[kind];
  return (
    <span
      className={`inline-block border px-1.5 py-[3px] font-mono text-[8.5px] font-semibold uppercase leading-none tracking-[0.14em] ${t.cls}`}
    >
      {t.label}
    </span>
  );
}

function Section({
  num,
  title,
  deck,
  children,
}: {
  num: string;
  title: string;
  deck?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8 first:mt-0">
      <div className="df-sechead">
        <span className="df-secnum">{num}</span>
        <h2 className="df-sectitle">{title}</h2>
        {deck && <span className="df-secdeck">{deck}</span>}
      </div>
      <div className="df-body">{children}</div>
    </section>
  );
}

/** Honest placeholder for a section whose backing data does not exist. */
function Unavailable({ text }: { text: string }) {
  return (
    <div className="df-card flex flex-wrap items-center gap-3 px-3 py-3">
      <span className="df-stamp" style={{ color: "#7899a9" }}>
        Not available
      </span>
      <p className="min-w-0 text-[12px] leading-relaxed text-jmuted">{text}</p>
    </div>
  );
}

/** Convex has not answered yet — never rendered as a result. */
function Loading({ what }: { what: string }) {
  return (
    <div className="df-card px-3 py-3">
      <p className="df-kicker">Loading {what}…</p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="df-kv-cell">
      <p className="df-kv-label">{label}</p>
      <p className="df-kv-value">{value}</p>
    </div>
  );
}

const evRef = (index: number) => `EV-${String(index + 1).padStart(2, "0")}`;
const msgRef = (n: number | null | undefined) =>
  n != null ? `MSG-${String(n).padStart(3, "0")}` : null;

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state } = useJaal();
  const report = state.reports.find((r) => r.id === id) ?? null;
  const caseId = report?.caseId ?? "";

  // Live, ownership-scoped AI sections. Skipped entirely while the report is
  // unknown so no query fires for a case that does not exist.
  const threat = useQuery(
    api.intelligence.getAnalysis,
    caseId ? { caseId, module: "threat" as const } : "skip",
  );
  const prediction = useQuery(
    api.intelligence.getAnalysis,
    caseId ? { caseId, module: "prediction" as const } : "skip",
  );
  const reportAssist = useQuery(
    api.intelligence.getAnalysis,
    caseId ? { caseId, module: "report" as const } : "skip",
  );
  const correlations = useQuery(
    api.intelligence.suggestions,
    caseId ? { caseId } : "skip",
  );

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

  // ---- Derivations — strictly from stored report data ---------------------
  const transcript = report.transcript;
  const tacticNames = Array.from(new Set(report.tactics.map((t) => t.name)));
  const authors = Array.from(new Set(transcript.map((m) => m.author)));
  const firstMessage = transcript[0] ?? null;
  const lastMessage = transcript[transcript.length - 1] ?? null;
  const firstResponse = transcript.find((m) => m.author !== "scammer") ?? null;
  const durationMs =
    firstMessage && lastMessage
      ? Math.max(0, lastMessage.timestamp - firstMessage.timestamp)
      : 0;

  // Key findings — derived strictly from stored report data.
  const findings: { text: string; alert?: boolean }[] = [];
  if (report.integrity.verified > 0) {
    findings.push({
      text: `${report.integrity.verified} of ${report.evidenceCount} preserved indicators integrity-verified — recomputed SHA-256 matches the recorded baseline.`,
    });
  }
  if (report.integrity.mismatched > 0) {
    findings.push({
      text: `${report.integrity.mismatched} indicator${
        report.integrity.mismatched === 1 ? "" : "s"
      } failed integrity verification — stored content changed after recording. Treat as altered.`,
      alert: true,
    });
  }
  if (tacticNames.length > 0) {
    findings.push({
      text: `${report.tactics.length} manipulation tactic detections across the conversation: ${tacticNames.join(", ")}.`,
    });
  }
  findings.push({
    text: `Kill-chain reached ${report.currentStage.toUpperCase()} across ${pluralize(transcript.length, "recorded message")}; case status ${report.status}.`,
  });

  const reviewedRows = report.evidence
    .map((e, i) => ({ row: e, num: evRef(i) }))
    .filter((x) => x.row.review?.status);

  const threatDone = threat?.status === "COMPLETED";
  const threatOutput = threatDone ? (threat.output as
    | {
        overview?: string;
        findings?: {
          category?: string;
          tactic?: string;
          severity?: string;
          explanation?: string;
          messageRefs?: { alias?: string; quote?: string }[];
          confidence?: string;
          recommendedAction?: string;
          limitations?: string[];
        }[];
        insights?: string[];
        recommendedSteps?: string[];
      }
    | null
    | undefined) : undefined;

  const predictionOutput = prediction?.status === "COMPLETED"
    ? (prediction.output as
        | {
            insufficientInformation?: boolean;
            currentStrategy?: string;
            predictions?: {
              action?: string;
              category?: string;
              explanation?: string;
              messageRefs?: { alias?: string; quote?: string }[];
              confidence?: string;
              risk?: string;
              suggestedResponse?: string;
              uncertainty?: string;
            }[];
            indicators?: { label?: string; level?: string }[];
          }
        | null
        | undefined)
    : undefined;

  const reportOutput = reportAssist?.status === "COMPLETED"
    ? (reportOutputShape(reportAssist.output))
    : undefined;

  const suggestionRows = correlations?.suggestions ?? [];

  const meta: [string, ReactNode][] = [
    ["CASE_ID", report.caseId],
    ["REPORT_ID", report.id],
    [
      "REPORT_VERSION",
      report.reportVersion != null
        ? String(report.reportVersion)
        : "not recorded",
    ],
    ["STATUS", (STATUS_LABEL[report.status] ?? report.status).toUpperCase()],
    ["ENVIRONMENT", report.simulated ? "SIMULATION" : "LIVE DATA"],
    ["STAGE", report.currentStage.toUpperCase()],
    ["GENERATED", formatDateTime(report.generatedAt)],
    ["ANALYST", report.generatedBy],
  ];

  return (
    <div className="mx-auto w-full max-w-[1220px] px-3 py-5 sm:px-6 sm:py-7">
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
        className="df-sheet df-grid"
      >
        {/* ======================= FORENSIC HEADER ======================= */}
        <header>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center border border-jcyan/50 bg-jcyan/5 text-jcyan">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="df-mono text-[13px] font-bold leading-tight tracking-[0.26em] text-jcyan">
                  JAAL // FORENSICS CONSOLE
                </p>
                <p className="df-kicker mt-1.5">Digital forensic report</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="df-stamp"
                style={stamp("inv", invKey(report.status))}
              >
                {STATUS_LABEL[report.status] ?? report.status}
              </span>
              <span
                className="df-stamp"
                style={stamp(
                  "engine",
                  report.simulated ? "simulation" : "claude",
                )}
              >
                {report.simulated ? "Simulation" : "Live data"}
              </span>
            </div>
          </div>

          <hr className="df-rule-strong mt-3" />

          <h1 className="mt-4 text-[19px] font-bold uppercase leading-tight tracking-[0.06em] text-jtext sm:text-[23px]">
            {report.title}
          </h1>
          <p className="df-kicker mt-2">
            Scam category · {report.category}
          </p>

          <div className="df-kv mt-4">
            {meta.map(([k, v]) => (
              <Meta key={k} label={k} value={v} />
            ))}
          </div>
        </header>

        {/* ======================= INVESTIGATION OVERVIEW ======================= */}
        <section className="mt-7" aria-label="Investigation overview">
          <div className="df-sechead">
            <span className="df-secnum">§</span>
            <h2 className="df-sectitle">Investigation overview</h2>
            <span className="df-secdeck">
              report generation {formatDateTime(report.generatedAt)}
            </span>
          </div>
          <div className="df-body">
            <div className="df-kv">
              <Meta label="Investigation title" value={report.title} />
              <Meta label="Scam category" value={report.category} />
              <Meta
                label="Investigation stage"
                value={report.currentStage.toUpperCase()}
              />
              <Meta
                label="Report generation"
                value={formatDateTime(report.generatedAt)}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["Messages analysed", transcript.length],
                  ["Evidence items", report.evidenceCount],
                  ["Extracted indicators", report.evidence.length],
                  [
                    "Threat findings",
                    threatOutput?.findings?.length ?? "—",
                  ],
                ] as [string, number | string][]
              ).map(([k, v]) => (
                <div key={k} className="df-card px-3 py-2.5">
                  <p className="df-mono text-[20px] font-bold leading-none text-jtext">
                    {v}
                  </p>
                  <p className="df-kicker mt-1.5">{k}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ======================= BODY + EVIDENCE RAIL ======================= */}
        <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_312px]">
          <main className="min-w-0">
            {/* ---------------- 01 · CASE SUMMARY ---------------- */}
            <Section
              num="01"
              title="Case summary"
              deck="identification and scope"
            >
              <div className="df-cols df-cols-wide-left">
                <div className="df-card p-3">
                  <p className="df-kicker">Record</p>
                  <dl className="mt-2">
                    {(
                      [
                        ["Investigation title", report.title],
                        ["Case ID", report.caseId],
                        ["Report ID", report.id],
                        ["Scam category", report.category],
                        ["Investigation stage", report.currentStage],
                        ["Analyst", report.generatedBy],
                        [
                          "Generated",
                          `${formatDateTime(report.generatedAt)}${
                            report.reportVersion != null
                              ? ` · v${report.reportVersion}`
                              : ""
                          }`,
                        ],
                      ] as [string, string][]
                    ).map(([k, v]) => (
                      <div
                        key={k}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-jborder/50 py-1.5 last:border-0"
                      >
                        <dt className="df-kicker">{k}</dt>
                        <dd className="df-mono min-w-0 break-words text-right text-[11.5px] font-semibold text-jtext">
                          {v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="df-card p-3">
                  <p className="df-kicker">Summary</p>
                  <p className="mt-2 text-[13px] leading-[1.7] text-jtext/90">
                    {report.description || "No case description recorded."}
                  </p>
                  <div className="mt-3">
                    <Tag kind="fact" />
                  </div>
                </div>
              </div>

              <div className="df-card mt-3 p-3">
                <p className="df-kicker">Key findings</p>
                <ol className="mt-2">
                  {findings.map((f, i) => (
                    <li
                      key={i}
                      className="flex gap-3 border-b border-jborder/40 py-2 last:border-0"
                    >
                      <span className="df-mono shrink-0 text-[11px] font-bold text-jcyan">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={`text-[12.5px] leading-relaxed ${
                          f.alert ? "text-jred" : "text-jtext/90"
                        }`}
                      >
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </Section>

            {/* ---------------- 02 · INCIDENT OVERVIEW ---------------- */}
            <Section
              num="02"
              title="Incident overview"
              deck="how the incident unfolded"
            >
              <div className="df-card p-3">
                <p className="df-kicker">Claimed scenario</p>
                <p className="mt-2 text-[13px] leading-[1.7] text-jtext/90">
                  {report.summary.scenario || "—"}
                </p>
                <div className="mt-3">
                  <Tag kind="fact" />
                </div>
              </div>

              <div className="df-kv mt-3">
                <Meta
                  label="Initial contact"
                  value={
                    firstMessage
                      ? `${msgRef(1)} · ${formatTime(firstMessage.timestamp)}`
                      : "—"
                  }
                />
                <Meta
                  label="First decoy response"
                  value={
                    firstResponse
                      ? `${msgRef(transcript.indexOf(firstResponse) + 1)} · ${formatTime(firstResponse.timestamp)}`
                      : "—"
                  }
                />
                <Meta
                  label="Total duration"
                  value={firstMessage ? formatElapsed(durationMs) : "—"}
                />
                <Meta
                  label="Last record"
                  value={
                    lastMessage
                      ? `${msgRef(transcript.length)} · ${formatTime(lastMessage.timestamp)}`
                      : "—"
                  }
                />
              </div>

              <div className="df-card mt-3 p-3">
                <p className="df-kicker">Kill-chain progression</p>
                <div className="df-tl mt-2">
                  {report.stages.map((s) => (
                    <div
                      key={s.id}
                      className={`df-tl-item ${s.status === "pending" ? "df-tl-item-muted" : ""}`}
                    >
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="df-mono text-[10px] font-bold tracking-[0.12em] text-jcyan">
                          {String(s.number).padStart(2, "0")}
                        </span>
                        <span className="text-[12.5px] font-semibold text-jtext">
                          {s.label}
                        </span>
                        <span
                          className="df-stamp"
                          style={stamp("stage", s.status)}
                        >
                          {s.status}
                        </span>
                      </div>
                      {s.detectedAt && (
                        <p className="df-mono mt-1 text-[10px] leading-relaxed text-jmuted">
                          {formatDateTime(s.detectedAt)} — {s.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            {/* ---------------- 03 · CONVERSATION ANALYSIS ---------------- */}
            <Section
              num="03"
              title="Conversation analysis"
              deck={`${pluralize(transcript.length, "recorded message")}`}
            >
              <div className="df-kv">
                <Meta label="Messages analysed" value={transcript.length} />
                <Meta label="Participants" value={authors.join(" / ") || "—"} />
                <Meta
                  label="Scammer messages"
                  value={transcript.filter((m) => m.author === "scammer").length}
                />
                <Meta
                  label="Decoy messages"
                  value={transcript.filter((m) => m.author !== "scammer").length}
                />
              </div>

              <div className="df-cols df-cols-2 mt-3">
                <div className="df-card p-3">
                  <p className="df-kicker">Pressure pattern</p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-jtext/90">
                    {report.summary.tactics || "—"}
                  </p>
                </div>
                <div className="df-card p-3">
                  <p className="df-kicker">Payment pressure</p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-jtext/90">
                    {report.summary.payment || "—"}
                  </p>
                </div>
              </div>

              {report.summary.moments.length > 0 && (
                <div className="df-card mt-3 p-3">
                  <p className="df-kicker">Important moments</p>
                  <div className="df-tl mt-2">
                    {report.summary.moments.map((m, i) => (
                      <div key={i} className="df-tl-item">
                        <p className="text-[13px] italic leading-relaxed text-jtext">
                          “{m.text}”
                        </p>
                        <p className="df-mono mt-1 text-[9.5px] uppercase tracking-[0.14em] text-jmuted">
                          {m.label} · {formatTime(m.timestamp)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <Tag kind="fact" />
                  </div>
                </div>
              )}

              {transcript.length > 0 && (
                <div className="df-card mt-3 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="df-kicker">Recorded transcript — verbatim</p>
                    <Tag kind="fact" />
                  </div>
                  <div className="mt-2">
                    {transcript.map((m, i) => {
                      const suspect = m.author === "scammer";
                      return (
                        <div
                          key={i}
                          className={`border-l-2 py-1.5 pl-3 ${
                            suspect
                              ? "border-jred/60"
                              : "border-jteal/70 sm:ml-5"
                          }`}
                        >
                          <p className="df-mono text-[9.5px] uppercase tracking-[0.12em] text-jmuted">
                            {msgRef(i + 1)} ·{" "}
                            {suspect ? "suspect" : m.author} ·{" "}
                            {formatTime(m.timestamp)}
                          </p>
                          <p className="mt-0.5 text-[12.5px] leading-relaxed text-jtext/90">
                            {m.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Section>

            {/* ---------------- 04 · DETECTED SCAM TACTICS ---------------- */}
            <Section
              num="04"
              title="Detected scam tactics"
              deck={`${pluralize(report.tactics.length, "rule-based detection")}`}
            >
              <div className="df-card mb-3 flex flex-wrap items-center gap-3 px-3 py-2.5">
                <Tag kind="rule" />
                <p className="min-w-0 text-[11.5px] leading-relaxed text-jmuted">
                  Content-pattern detections produced without a model. This
                  detector assigns neither severity nor confidence — AI-graded
                  severity for this case&apos;s tactics appears in section 08.
                </p>
              </div>

              {report.tactics.length === 0 ? (
                <Unavailable text="No tactic patterns matched this conversation." />
              ) : (
                <div className="df-cols df-cols-2">
                  {report.tactics.map((t, i) => {
                    const linkedEvidence = report.evidence
                      .map((e, idx) => ({ e, idx }))
                      .filter(
                        (x) =>
                          t.messageNumber != null &&
                          x.e.sourceMessageNumber === t.messageNumber,
                      );
                    return (
                      <div key={i} className="df-card p-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-jtext">
                            {t.name}
                          </p>
                          <span className="df-mono text-[9.5px] tracking-[0.12em] text-jmuted">
                            {msgRef(t.messageNumber) ?? "source not linked"}
                          </span>
                        </div>
                        <p className="df-mono mt-1 text-[9.5px] tracking-[0.1em] text-jmuted">
                          {formatDateTime(t.timestamp)}
                        </p>
                        <p className="mt-2 text-[12.5px] leading-relaxed text-jtext/85">
                          {t.explanation}
                        </p>
                        <p className="mt-2 border-l-2 border-jamber/70 pl-3 text-[12.5px] leading-relaxed text-jtext/90">
                          “{t.sourceText}”
                        </p>
                        {linkedEvidence.length > 0 && (
                          <p className="df-mono mt-2 text-[9.5px] tracking-[0.1em] text-jmuted">
                            EVIDENCE ·{" "}
                            {linkedEvidence
                              .map((x) => evRef(x.idx))
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* ---------------- 05 · EXTRACTED INDICATORS ---------------- */}
            <Section
              num="05"
              title="Extracted indicators"
              deck={`${pluralize(report.evidence.length, "indicator")}`}
            >
              {report.evidence.length === 0 ? (
                <Unavailable text="No indicators were extracted from this conversation." />
              ) : (
                <>
                  <div className="df-card">
                    <table className="df-table">
                      <colgroup>
                        <col style={{ width: "22%" }} />
                        <col style={{ width: "26%" }} />
                        <col style={{ width: "24%" }} />
                        <col style={{ width: "14%" }} />
                        <col style={{ width: "14%" }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Value (masked)</th>
                          <th>Method</th>
                          <th>Source msg</th>
                          <th>Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.evidence.map((e, i) => (
                          <tr key={e.id}>
                            <td>
                              <span className="flex items-start gap-2">
                                <span
                                  className="mt-1 size-1.5 shrink-0"
                                  style={{
                                    backgroundColor: indicatorAccent(e.type),
                                  }}
                                />
                                <span className="min-w-0">
                                  <span className="df-mono block text-[9.5px] tracking-[0.1em] text-jmuted">
                                    {evRef(i)}
                                  </span>
                                  <span className="block font-semibold text-jtext">
                                    {e.label}
                                  </span>
                                </span>
                              </span>
                            </td>
                            <td className="df-mono text-jtext">
                              {maskValue(e.value)}
                            </td>
                            <td className="df-mono text-[10px] text-jmuted">
                              {e.detectionMethod ?? "—"}
                            </td>
                            <td className="df-mono text-[10.5px] text-jmuted">
                              {msgRef(e.sourceMessageNumber) ?? "—"}
                            </td>
                            <td className="df-mono text-[10.5px]">
                              {e.confidence != null ? (
                                <span className="text-jgreen">
                                  {Math.round(e.confidence * 100)}%
                                </span>
                              ) : (
                                <span className="text-jmuted">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="df-card mt-3 flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <Tag kind="rule" />
                    <p className="min-w-0 text-[11.5px] leading-relaxed text-jmuted">
                      Regex extraction with validation, no model involved.
                      Values are masked for display — the full values are
                      preserved in the case record and in the JSON export.
                    </p>
                  </div>
                </>
              )}
            </Section>

            {/* ---------------- 06 · EVIDENCE INVENTORY ---------------- */}
            <Section
              num="06"
              title="Evidence inventory"
              deck={`${pluralize(report.evidence.length, "preserved item")}`}
            >
              {report.evidence.length === 0 ? (
                <Unavailable text="No evidence preserved for this case." />
              ) : (
                <div className="df-card">
                  <table className="df-table">
                    <colgroup>
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "24%" }} />
                      <col style={{ width: "20%" }} />
                      <col style={{ width: "22%" }} />
                      <col style={{ width: "20%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Evidence ID</th>
                        <th>Type</th>
                        <th>Extracted</th>
                        <th>Hash status</th>
                        <th>Review</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.evidence.map((e, i) => (
                        <tr key={e.id}>
                          <td className="df-mono font-semibold text-jcyan">
                            {evRef(i)}
                          </td>
                          <td>
                            <span className="block font-semibold text-jtext">
                              {e.label}
                            </span>
                            <span className="df-mono block text-[9.5px] tracking-[0.1em] text-jmuted">
                              {e.type}
                            </span>
                          </td>
                          <td className="df-mono text-[10.5px] text-jmuted">
                            {formatDateTime(e.extractedAt)}
                            <span className="mt-0.5 block">
                              {msgRef(e.sourceMessageNumber) ?? "not linked"}
                            </span>
                          </td>
                          <td>
                            <span
                              className="df-stamp"
                              style={stamp(
                                "integrity",
                                integrityKey(e.hashStatus),
                              )}
                            >
                              {INTEGRITY_LABEL[e.hashStatus] ?? e.hashStatus}
                            </span>
                          </td>
                          <td>
                            {e.review?.status ? (
                              <span
                                className="df-stamp"
                                style={stamp(
                                  "review",
                                  reviewKey(e.review.status) ?? "needsreview",
                                )}
                              >
                                {VERDICT_LABEL[e.review.status] ??
                                  e.review.status}
                              </span>
                            ) : (
                              <span
                                className="df-stamp"
                                style={stamp("review", "needsreview")}
                              >
                                Not reviewed
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* ---------------- 07 · INVESTIGATION TIMELINE ---------------- */}
            <Section
              num="07"
              title="Investigation timeline"
              deck={`${pluralize(report.timeline.length, "recorded event")}`}
            >
              {report.timeline.length === 0 ? (
                <Unavailable text="No timeline events recorded." />
              ) : (
                <div className="df-card p-3">
                  <div className="df-tl">
                    {report.timeline.map((t, i) => (
                      <div
                        key={i}
                        className={`df-tl-item ${
                          i % 2 === 1 ? "df-tl-item-muted" : ""
                        }`}
                      >
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="df-mono text-[9.5px] font-bold tracking-[0.12em] text-jcyan">
                            {String(i + 1).padStart(3, "0")}
                          </span>
                          <span className="df-mono text-[10px] text-jmuted">
                            {formatTime(t.timestamp)}
                          </span>
                          <span className="df-mono border border-jborder/70 px-1.5 py-px text-[8.5px] uppercase tracking-[0.14em] text-jmuted">
                            {t.kind}
                          </span>
                          <span className="text-[12.5px] font-semibold text-jtext">
                            {t.title}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-jmuted">
                          {t.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {/* ---------------- 08 · AI THREAT INTELLIGENCE ---------------- */}
            <Section
              num="08"
              title="AI threat intelligence"
              deck={
                threat === undefined
                  ? "loading"
                  : threat === null
                    ? "not generated"
                    : `module · ${threat.status.toLowerCase()}`
              }
            >
              <div className="df-card mb-3 flex flex-wrap items-center gap-3 px-3 py-2.5">
                <Tag kind="ai" />
                <p className="min-w-0 text-[11.5px] leading-relaxed text-jmuted">
                  Model-written interpretation of the case record. It is an
                  opinion grounded in cited messages, not an observed event.
                </p>
              </div>

              {threat === undefined ? (
                <Loading what="threat analysis" />
              ) : threat === null ? (
                <Unavailable text="No threat analysis has been run for this case. Open the AI intelligence hub for this investigation to generate one." />
              ) : threat.status !== "COMPLETED" ? (
                <Unavailable
                  text={`Threat analysis status: ${threat.status}.${
                    threat.error ? ` Reason: ${threat.error}.` : ""
                  }`}
                />
              ) : (
                <>
                  <div className="df-kv">
                    <Meta label="Provider" value={threat.provider ?? "—"} />
                    <Meta label="Model" value={threat.model ?? "—"} />
                    <Meta label="Analysed" value={formatDateTime(threat.at)} />
                    <Meta
                      label="Input messages"
                      value={threat.inputMessageCount}
                    />
                  </div>

                  {threat.stale && (
                    <div className="df-card mt-3 border-jamber/50 px-3 py-2.5">
                      <p className="df-kicker">Stale analysis</p>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-jmuted">
                        The conversation has changed since this analysis ran —
                        it reflects {threat.inputMessageCount} earlier messages.
                      </p>
                    </div>
                  )}

                  {threatOutput?.overview && (
                    <div className="df-card mt-3 p-3">
                      <p className="df-kicker">Overview</p>
                      <p className="mt-2 text-[13px] leading-[1.7] text-jtext/90">
                        {threatOutput.overview}
                      </p>
                    </div>
                  )}

                  {(threatOutput?.findings ?? []).map((f, i) => (
                    <div key={i} className="df-card mt-3 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span
                            className={`df-stamp ${sevClass(f.severity)}`}
                          >
                            {f.severity ?? "unrated"}
                          </span>
                          <span className="text-[13px] font-bold uppercase tracking-[0.05em] text-jtext">
                            {f.tactic ?? "Untitled finding"}
                          </span>
                        </div>
                        <span
                          className={`df-mono text-[9.5px] uppercase tracking-[0.14em] ${
                            CONFIDENCE_CLASS[
                              (f.confidence ?? "").toLowerCase()
                            ] ?? "text-jmuted"
                          }`}
                        >
                          confidence {f.confidence ?? "—"}
                        </span>
                      </div>
                      <p className="df-mono mt-1.5 text-[9.5px] uppercase tracking-[0.14em] text-jmuted">
                        {f.category ?? "—"}
                      </p>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-jtext/90">
                        {f.explanation}
                      </p>

                      {(f.messageRefs ?? []).length > 0 && (
                        <div className="mt-3 border-t border-jborder/50 pt-2">
                          <p className="df-kicker">Supporting messages</p>
                          <ul className="mt-1.5">
                            {(f.messageRefs ?? []).map((r, j) => (
                              <li key={j} className="flex gap-2 py-1">
                                <span className="df-mono shrink-0 text-[9.5px] font-semibold tracking-[0.1em] text-jcyan">
                                  {r.alias ?? "—"}
                                </span>
                                <span className="min-w-0 text-[12px] leading-relaxed text-jmuted">
                                  {r.quote ?? ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {f.recommendedAction && (
                        <div className="mt-2 border-t border-jborder/50 pt-2">
                          <p className="df-kicker">Recommended action</p>
                          <p className="mt-1 text-[12.5px] leading-relaxed text-jtext/90">
                            {f.recommendedAction}
                          </p>
                        </div>
                      )}

                      {(f.limitations ?? []).length > 0 && (
                        <ul className="mt-2">
                          {(f.limitations ?? []).map((l, j) => (
                            <li
                              key={j}
                              className="df-mono py-0.5 text-[10.5px] leading-relaxed text-jmuted"
                            >
                              · {l}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}

                  {(threatOutput?.insights ?? []).length > 0 && (
                    <div className="df-card mt-3 p-3">
                      <p className="df-kicker">Insights</p>
                      <ul className="mt-1.5">
                        {(threatOutput?.insights ?? []).map((x, i) => (
                          <li
                            key={i}
                            className="border-b border-jborder/40 py-1.5 text-[12.5px] leading-relaxed text-jtext/90 last:border-0"
                          >
                            {x}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {threat.limitations.length > 0 && (
                    <div className="df-card mt-3 p-3">
                      <p className="df-kicker">Module limitations</p>
                      <ul className="mt-1.5">
                        {threat.limitations.map((l, i) => (
                          <li
                            key={i}
                            className="df-mono py-0.5 text-[10.5px] leading-relaxed text-jmuted"
                          >
                            · {l}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </Section>

            {/* ---------------- 09 · BEHAVIOUR PREDICTIONS ---------------- */}
            <Section
              num="09"
              title="Behaviour predictions"
              deck={
                prediction === undefined
                  ? "loading"
                  : prediction === null
                    ? "not generated"
                    : `module · ${prediction.status.toLowerCase()}`
              }
            >
              <div className="df-card mb-3 border-jamber/50 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <Tag kind="prediction" />
                  <p className="min-w-0 text-[11.5px] leading-relaxed text-jmuted">
                    Hypothetical next moves. These are possibilities the model
                    considers plausible — none of them has occurred, and none is
                    a claim about what happened.
                  </p>
                </div>
              </div>

              {prediction === undefined ? (
                <Loading what="behaviour prediction" />
              ) : prediction === null ? (
                <Unavailable text="No behaviour prediction has been generated for this case." />
              ) : prediction.status !== "COMPLETED" ? (
                <Unavailable
                  text={`Prediction status: ${prediction.status}.${
                    prediction.error ? ` Reason: ${prediction.error}.` : ""
                  }`}
                />
              ) : (
                <>
                  {predictionOutput?.insufficientInformation && (
                    <div className="df-card mb-3 border-jamber/50 px-3 py-2.5">
                      <p className="df-kicker">Insufficient information</p>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-jmuted">
                        The model judged the conversation too thin to predict
                        behaviour responsibly.
                      </p>
                    </div>
                  )}

                  {predictionOutput?.currentStrategy && (
                    <div className="df-card p-3">
                      <p className="df-kicker">Observed strategy</p>
                      <p className="mt-2 text-[13px] leading-[1.7] text-jtext/90">
                        {predictionOutput.currentStrategy}
                      </p>
                    </div>
                  )}

                  {(predictionOutput?.predictions ?? []).map((p, i) => (
                    <div key={i} className="df-card mt-3 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className={`df-stamp ${sevClass(p.risk)}`}>
                            risk {p.risk ?? "unrated"}
                          </span>
                          <span className="text-[13px] font-bold text-jtext">
                            {p.action ?? "Untitled prediction"}
                          </span>
                        </div>
                        <span className="df-mono text-[9.5px] uppercase tracking-[0.14em] text-jamber">
                          {p.confidence ?? "—"}
                        </span>
                      </div>
                      <p className="df-mono mt-1.5 text-[9.5px] uppercase tracking-[0.14em] text-jmuted">
                        {p.category ?? "—"}
                      </p>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-jtext/90">
                        {p.explanation}
                      </p>

                      {(p.messageRefs ?? []).length > 0 && (
                        <p className="df-mono mt-2 text-[9.5px] tracking-[0.1em] text-jmuted">
                          GROUNDED IN ·{" "}
                          {(p.messageRefs ?? [])
                            .map((r) => r.alias ?? "—")
                            .join(", ")}
                        </p>
                      )}

                      {p.suggestedResponse && (
                        <div className="mt-2 border-t border-jborder/50 pt-2">
                          <p className="df-kicker">Suggested response</p>
                          <p className="mt-1 text-[12.5px] leading-relaxed text-jtext/90">
                            {p.suggestedResponse}
                          </p>
                        </div>
                      )}
                      {p.uncertainty && (
                        <div className="mt-2 border-t border-jborder/50 pt-2">
                          <p className="df-kicker">Uncertainty</p>
                          <p className="mt-1 text-[12.5px] leading-relaxed text-jmuted">
                            {p.uncertainty}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}

                  {(predictionOutput?.indicators ?? []).length > 0 && (
                    <div className="df-card mt-3 p-3">
                      <p className="df-kicker">Behavioural indicators</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(predictionOutput?.indicators ?? []).map((x, i) => (
                          <span
                            key={i}
                            className="border border-jborder/70 bg-jsurface/70 px-2 py-1 font-mono text-[10px] text-jtext"
                          >
                            {x.label}
                            {x.level && (
                              <span className="ml-1.5 text-jmuted">
                                {x.level}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </Section>

            {/* ---------------- 10 · EVIDENCE CORRELATIONS ---------------- */}
            <Section
              num="10"
              title="Evidence correlations"
              deck={
                correlations === undefined
                  ? "loading"
                  : `${pluralize(suggestionRows.length, "candidate relationship")}`
              }
            >
              <div className="df-card mb-3 flex flex-wrap items-center gap-3 px-3 py-2.5">
                <Tag kind="pending" />
                <p className="min-w-0 text-[11.5px] leading-relaxed text-jmuted">
                  Candidate relationships proposed by AI or by a deterministic
                  rule pass. Nothing here is a finding until an investigator
                  accepts it.
                </p>
              </div>

              {correlations === undefined ? (
                <Loading what="correlation suggestions" />
              ) : suggestionRows.length === 0 ? (
                <Unavailable text="No correlation suggestions exist for this case yet." />
              ) : (
                <>
                  <div className="df-kv mb-3">
                    <Meta
                      label="Suggestions"
                      value={suggestionRows.length}
                    />
                    <Meta
                      label="Pending review"
                      value={
                        suggestionRows.filter(
                          (s) => s.status === "PENDING_REVIEW",
                        ).length
                      }
                    />
                    <Meta
                      label="Accepted"
                      value={
                        suggestionRows.filter((s) => s.status === "ACCEPTED")
                          .length
                      }
                    />
                    <Meta
                      label="Rejected"
                      value={
                        suggestionRows.filter((s) => s.status === "REJECTED")
                          .length
                      }
                    />
                  </div>

                  {suggestionRows.map((s) => (
                    <div key={s.id} className="df-card mt-3 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="df-mono text-[11px] font-semibold tracking-[0.08em] text-jcyan">
                          {s.source?.label ?? "—"}{" "}
                          <span className="text-jmuted">→</span>{" "}
                          {s.target?.label ?? "—"}
                        </p>
                        <span
                          className="df-stamp"
                          style={stamp(
                            "review",
                            s.status === "ACCEPTED"
                              ? "confirmed"
                              : s.status === "REJECTED"
                                ? "incorrect"
                                : "needsreview",
                          )}
                        >
                          {s.status === "PENDING_REVIEW"
                            ? "Pending review"
                            : s.status === "ACCEPTED"
                              ? "Accepted"
                              : "Rejected"}
                        </span>
                      </div>
                      <p className="df-mono mt-1.5 text-[9.5px] uppercase tracking-[0.14em] text-jmuted">
                        {s.relation} · {s.category} · confidence {s.confidence}{" "}
                        · origin {s.origin}
                      </p>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-jtext/90">
                        {s.explanation}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="df-mono text-[9.5px] tracking-[0.1em] text-jmuted">
                          MSG ·{" "}
                          {s.messageRefs.length
                            ? s.messageRefs.join(", ")
                            : "—"}
                        </span>
                        <span className="df-mono text-[9.5px] tracking-[0.1em] text-jmuted">
                          EVID ·{" "}
                          {s.evidenceRefs.length
                            ? s.evidenceRefs.join(", ")
                            : "—"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-jborder/50 pt-2">
                        <Tag
                          kind={
                            s.status === "ACCEPTED"
                              ? "confirmed"
                              : s.status === "REJECTED"
                                ? "pending"
                                : "ai"
                          }
                        />
                        <span className="df-mono text-[9.5px] tracking-[0.1em] text-jmuted">
                          {s.origin === "AI"
                            ? "Model-generated suggestion"
                            : "Deterministic rule pass"}
                          {s.reviewer ? ` · ${s.reviewer}` : ""}
                          {s.reviewedAt
                            ? ` · ${formatDateTime(s.reviewedAt)}`
                            : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </Section>

            {/* ---------------- 11 · INVESTIGATOR OBSERVATIONS ---------------- */}
            <Section
              num="11"
              title="Investigator observations"
              deck={report.generatedBy}
            >
              <div className="df-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="df-kicker">Analyst notes</p>
                  <Tag kind="fact" />
                </div>
                <p className="mt-2 border-l-2 border-jcyan/70 pl-4 text-[13.5px] italic leading-[1.7] text-jtext">
                  {report.analystNotes}
                </p>
                <p className="df-mono mt-2 text-right text-[9.5px] uppercase tracking-[0.14em] text-jmuted">
                  — {report.generatedBy}, analyst of record
                </p>
              </div>

              <div className="df-card mt-3 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="df-kicker">Analyst verdicts</p>
                  <Tag kind="confirmed" />
                </div>
                {reviewedRows.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-jmuted">
                    No analyst verdicts recorded yet.
                  </p>
                ) : (
                  <div className="mt-2">
                    {reviewedRows.map(({ row, num }) => (
                      <div
                        key={row.id}
                        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-jborder/40 py-2 last:border-0"
                      >
                        <span className="df-mono text-[10px] font-bold tracking-[0.1em] text-jcyan">
                          {num}
                        </span>
                        <span
                          className="df-stamp"
                          style={stamp(
                            "review",
                            reviewKey(row.review!.status!) ?? "needsreview",
                          )}
                        >
                          {VERDICT_LABEL[row.review!.status!] ??
                            row.review!.status!}
                        </span>
                        <span className="df-mono min-w-0 break-words text-[11px] text-jtext">
                          {maskValue(row.value)}
                        </span>
                        {row.review!.note && (
                          <span className="min-w-0 text-[12px] italic text-jmuted">
                            {row.review!.note}
                          </span>
                        )}
                        {row.review!.reviewedAt && (
                          <span className="df-mono ml-auto text-[9.5px] tracking-[0.1em] text-jmuted">
                            {formatDateTime(row.review!.reviewedAt)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            {/* ---------------- 12 · RECOMMENDED ACTIONS ---------------- */}
            <Section
              num="12"
              title="Recommended actions"
              deck="next steps for the investigator"
            >
              <div className="df-card mb-3 flex flex-wrap items-center gap-3 px-3 py-2.5">
                <Tag kind="ai" />
                <p className="min-w-0 text-[11.5px] leading-relaxed text-jmuted">
                  Advice generated by the AI modules. It has not been executed
                  and is not an instruction from any authority.
                </p>
              </div>

              {reportAssist === undefined || threat === undefined ? (
                <Loading what="recommendations" />
              ) : (
                <>
                  {(reportOutput?.recommendations ?? []).length === 0 &&
                  (threatOutput?.recommendedSteps ?? []).length === 0 && (
                    <Unavailable text="No recommended actions have been generated for this case. Run the Threat Intelligence Analyst or the Forensic Report Assistant to produce them." />
                  )}

                  {(reportOutput?.recommendations ?? []).length > 0 && (
                    <div className="df-card p-3">
                      <p className="df-kicker">
                        Forensic report assistant
                      </p>
                      <ol className="mt-1.5">
                        {(reportOutput?.recommendations ?? []).map((r, i) => (
                          <li
                            key={i}
                            className="flex gap-3 border-b border-jborder/40 py-2 last:border-0"
                          >
                            <span className="df-mono shrink-0 text-[11px] font-bold text-jcyan">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="text-[12.5px] leading-relaxed text-jtext/90">
                              {r}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {(threatOutput?.recommendedSteps ?? []).length > 0 && (
                    <div className="df-card mt-3 p-3">
                      <p className="df-kicker">Threat intelligence analyst</p>
                      <ol className="mt-1.5">
                        {(threatOutput?.recommendedSteps ?? []).map(
                          (r, i) => (
                            <li
                              key={i}
                              className="flex gap-3 border-b border-jborder/40 py-2 last:border-0"
                            >
                              <span className="df-mono shrink-0 text-[11px] font-bold text-jcyan">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <span className="text-[12.5px] leading-relaxed text-jtext/90">
                                {r}
                              </span>
                            </li>
                          ),
                        )}
                      </ol>
                    </div>
                  )}
                </>
              )}
            </Section>

            {/* ---------------- 13 · INTEGRITY AND LIMITATIONS ---------------- */}
            <Section
              num="13"
              title="Integrity and limitations"
              deck={`algorithm · ${report.hashAlgorithm ?? "SHA-256"}`}
            >
              <div className="df-card p-3">
                <p className="df-kicker">Integrity counts</p>
                <div className="mt-2 grid grid-cols-2 gap-px bg-jborder/60 sm:grid-cols-5">
                  {(
                    [
                      ["Collected", report.integrity.collected, "none"],
                      ["Hash stored", report.integrity.hashed, "none"],
                      ["Verified", report.integrity.verified, "low"],
                      ["Mismatch", report.integrity.mismatched, "critical"],
                      ["Unhashed", report.integrity.unhashed, "none"],
                    ] as [string, number, string][]
                  ).map(([k, v, tone]) => (
                    <div key={k} className="bg-jpanel px-3 py-2.5">
                      <p
                        className={`df-mono text-[20px] font-bold leading-none ${
                          tone === "critical"
                            ? "text-jred"
                            : tone === "low"
                              ? "text-jgreen"
                              : "text-jtext"
                        }`}
                      >
                        {v}
                      </p>
                      <p className="df-kicker mt-1.5">{k}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11.5px] leading-relaxed text-jmuted">
                  &ldquo;Verified&rdquo; means a recomputed digest matched the
                  recorded baseline. A hash merely existing is not a verified
                  state.
                </p>
              </div>

              <div className="df-card mt-3 p-3">
                <p className="df-kicker">What this investigation could not establish</p>
                {report.unknowns.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-jmuted">
                    No gaps recorded.
                  </p>
                ) : (
                  <ul className="mt-1.5">
                    {report.unknowns.map((u, i) => (
                      <li
                        key={i}
                        className="flex gap-3 border-b border-jborder/40 py-1.5 last:border-0"
                      >
                        <span className="df-mono shrink-0 text-jcyan">—</span>
                        <span className="text-[12.5px] leading-relaxed text-jtext/90">
                          {u}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {report.provenance && (
                <div className="df-card mt-3 p-3">
                  <p className="df-kicker">Provenance — where each statement comes from</p>
                  <div className="df-cols df-cols-2 mt-2">
                    {(
                      [
                        [
                          "Original conversation evidence",
                          report.provenance.conversation.split("\n"),
                          "fact",
                        ],
                        [
                          "Rule-based findings",
                          report.provenance.ruleBased,
                          "rule",
                        ],
                        [
                          "AI-assisted interpretations",
                          report.provenance.aiAssisted,
                          "ai",
                        ],
                        [
                          "Human-reviewed findings",
                          report.provenance.humanReviewed,
                          "confirmed",
                        ],
                        [
                          "Unverified assumptions",
                          report.provenance.unverifiedAssumptions,
                          "pending",
                        ],
                        [
                          "Simulation-only content",
                          report.provenance.simulationOnly,
                          "simulation",
                        ],
                      ] as [string, string[], keyof typeof PROVENANCE][]
                    ).map(([label, items, kind]) => (
                      <div key={label} className="border border-jborder/50 p-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="df-kicker">{label}</p>
                        </div>
                        <ul className="mt-1.5">
                          {items.map((x, i) => (
                            <li
                              key={i}
                              className="py-1 text-[12px] leading-relaxed text-jtext/85"
                            >
                              <span className="text-jmuted">· </span>
                              {x}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-1.5">
                          <Tag kind={kind} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="df-disclaimer mt-3">
                A database-stored SHA-256 baseline detects changes relative to
                that baseline. It does not independently establish source
                authenticity, legal admissibility, authorship, or an externally
                anchored chain of custody. Identifiers in this file are
                synthetic demo material extracted from a controlled simulation.
              </p>
            </Section>
          </main>

          {/* ======================= EVIDENCE RAIL ======================= */}
          <aside className="df-rail min-w-0 space-y-4">
            {/* ---- Evidence spotlight ---- */}
            <div>
              <div className="df-sechead">
                <span className="df-secnum">§</span>
                <h2 className="df-sectitle">Evidence spotlight</h2>
                <span className="df-secdeck">
                  {pluralize(report.evidence.length, "item")}
                </span>
              </div>
              <div className="df-body space-y-3">
                {report.evidence.length === 0 ? (
                  <Unavailable text="No evidence preserved for this case." />
                ) : (
                  report.evidence.map((e, i) => (
                    <div
                      key={e.id}
                      className="df-card p-3"
                      style={{
                        borderLeft: `3px solid ${indicatorAccent(e.type)}`,
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="df-mono text-[11px] font-bold tracking-[0.12em] text-jcyan">
                          {evRef(i)}
                        </span>
                        <span
                          className="df-stamp"
                          style={stamp("integrity", integrityKey(e.hashStatus))}
                        >
                          {INTEGRITY_LABEL[e.hashStatus] ?? e.hashStatus}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-jtext">
                        {e.label}
                      </p>
                      <p className="df-mono mt-1 break-all text-[12px] text-jtext">
                        {maskValue(e.value)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-jborder/50 pt-2">
                        <span className="df-mono text-[9.5px] tracking-[0.1em] text-jmuted">
                          {msgRef(e.sourceMessageNumber) ?? "no source"}
                        </span>
                        <span className="df-mono text-[9.5px] tracking-[0.1em] text-jmuted">
                          {formatDateTime(e.extractedAt)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className="df-stamp"
                          style={stamp(
                            "review",
                            reviewKey(e.review?.status ?? null) ?? "needsreview",
                          )}
                        >
                          {e.review?.status
                            ? (VERDICT_LABEL[e.review.status] ??
                              e.review.status)
                            : "Not reviewed"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ---- Evidence integrity ---- */}
            <div>
              <div className="df-sechead">
                <span className="df-secnum">§</span>
                <h2 className="df-sectitle">Evidence integrity</h2>
                <span className="df-secdeck">
                  {report.hashAlgorithm ?? "SHA-256"}
                </span>
              </div>
              <div className="df-body space-y-3">
                {report.evidence.length === 0 ? (
                  <Unavailable text="No evidence to verify." />
                ) : (
                  report.evidence.map((e, i) => (
                    <div key={e.id} className="df-card p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="df-mono text-[10.5px] font-bold tracking-[0.1em] text-jcyan">
                          {evRef(i)}
                        </span>
                        <span className="df-mono text-[9.5px] uppercase tracking-[0.12em] text-jmuted">
                          {e.label}
                        </span>
                      </div>
                      <dl className="mt-2">
                        <div className="flex items-baseline justify-between gap-2 py-1">
                          <dt className="df-kicker">Algorithm</dt>
                          <dd className="df-mono text-[11px] font-semibold text-jtext">
                            {e.hashAlgorithm ?? (e.hash ? "SHA-256" : "—")}
                          </dd>
                        </div>
                        <div className="border-t border-jborder/50 py-1">
                          <dt className="df-kicker">Hash</dt>
                          <dd className="df-hash mt-1">
                            {e.hash ?? "not recorded"}
                          </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-2 border-t border-jborder/50 py-1">
                          <dt className="df-kicker">Status</dt>
                          <dd>
                            <span
                              className="df-stamp"
                              style={stamp(
                                "integrity",
                                integrityKey(e.hashStatus),
                              )}
                            >
                              {INTEGRITY_LABEL[e.hashStatus] ?? e.hashStatus}
                            </span>
                          </dd>
                        </div>
                        <div className="border-t border-jborder/50 py-1">
                          <dt className="df-kicker">Verification</dt>
                          <dd className="mt-1 text-[11.5px] leading-relaxed text-jtext/85">
                            {report.verification[i]?.note ??
                              VERIFICATION_NOTE[integrityKey(e.hashStatus)] ??
                              "Not yet verified."}
                          </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-2 border-t border-jborder/50 py-1">
                          <dt className="df-kicker">Verified at</dt>
                          <dd className="df-mono text-[11px] text-jmuted">
                            {e.review?.reviewedAt
                              ? formatDateTime(e.review.reviewedAt)
                              : "—"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ))
                )}
                <p className="df-disclaimer">
                  A stored SHA-256 baseline detects changes against that
                  baseline. It does not independently establish source
                  authenticity, legal admissibility, or a trusted timestamp.
                </p>
              </div>
            </div>
          </aside>
        </div>

        {/* ======================= FOOTER ======================= */}
        <footer className="mt-9">
          <hr className="df-rule-strong" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border border-jborder/70 bg-jsurface/70 px-3 py-2.5">
            <p className="df-mono text-[10px] font-bold tracking-[0.22em] text-jcyan">
              JAAL // DIGITAL FORENSIC DOSSIER
            </p>
            <p className="df-mono text-[9.5px] tracking-[0.14em] text-jmuted">
              CASE_ID: {report.caseId}
            </p>
            <p className="df-mono text-[9.5px] tracking-[0.14em] text-jmuted">
              REPORT_ID: {report.id}
            </p>
            <p className="df-mono text-[9.5px] tracking-[0.14em] text-jmuted">
              GENERATED: {formatDateTime(report.generatedAt)}
            </p>
          </div>

          {report.simulated && (
            <p className="df-disclaimer mt-3">
              This report contains simulated data produced in a controlled JAAL
              demonstration. No real-world interception, tracking or third-party
              verification took place; no real scammer, phone number, WhatsApp
              account or payment account was contacted, and no real money moved.
              Hashes verify content integrity only.
            </p>
          )}
        </footer>

        {/* Print-only running footer — repeats per page in Chromium */}
        <div className="df-runfoot">
          <span>JAAL // Digital forensic dossier</span>
          <span>
            {report.caseId} · {report.id}
          </span>
          <span>Generated {formatDateTime(report.generatedAt)}</span>
        </div>
      </motion.article>

      <p className="jaal-no-print mt-3 text-center text-[10px] text-jmuted/70">
        Use &ldquo;Print / save PDF&rdquo; and choose your browser&rsquo;s
        save-as-PDF option.
      </p>
    </div>
  );
}

/** Narrow structural read of the report-assistant output (recommendations). */
function reportOutputShape(
  output: unknown,
): { recommendations?: string[] } | undefined {
  if (!output || typeof output !== "object") return undefined;
  const recs = (output as { recommendations?: unknown }).recommendations;
  return {
    recommendations: Array.isArray(recs)
      ? recs.filter((x): x is string => typeof x === "string")
      : [],
  };
}
