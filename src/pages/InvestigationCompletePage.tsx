import { Chip, HASH_TONE, STAGE_STATUS_TONE } from "@/components/ui/panel";
import { useInvestigation } from "@/hooks/useInvestigation";
import { useJaal } from "@/state/JaalProvider";
import { TACTIC_META } from "@/services/investigationService";
import { exportReportJson } from "@/services/reportService";
import { buildCaseSummary } from "@/services/summaryService";
import { formatClock, formatDateTime } from "@/utils/formatters";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSignature,
  Flag,
  Fingerprint,
  Home,
  ShieldCheck,
  ShieldQuestion,
  XCircle,
} from "lucide-react";
import { useMemo } from "react";
import { Link, useParams } from "react-router";

/**
 * SCREEN 5 — INVESTIGATION COMPLETE.
 *
 * Shown when an investigation is ended. Summary, timeline and evidence
 * status are all derived from the recorded session, not filler text.
 */
export default function InvestigationCompletePage() {
  const { id } = useParams<{ id: string }>();
  const { investigation, runtime } = useInvestigation(id);
  const { createReport } = useJaal();

  const summary = useMemo(
    () =>
      investigation && runtime
        ? buildCaseSummary(investigation, runtime)
        : null,
    [investigation, runtime],
  );

  if (!investigation || !runtime || !summary) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Flag className="size-7 text-jmuted/60" />
        <p className="text-sm text-jmuted">Case not found in this session.</p>
        <Link
          to="/investigations"
          className="border border-jcyan/50 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-jcyan transition-colors hover:bg-jcyan/10"
        >
          Back to investigations
        </Link>
      </div>
    );
  }

  const completedAt = runtime.endedAt ?? investigation.lastActivityAt;
  const identifiers = runtime.evidence.filter((e) => e.type !== "transcript");
  const hashed = runtime.evidence.filter((e) => e.hash);
  const verified = runtime.evidence.filter((e) => e.hashStatus === "verified");
  const mismatched = runtime.evidence.filter((e) => e.hashStatus === "mismatch");

  const handleViewReport = () => {
    const report = createReport(investigation.id);
    if (report) window.location.assign(`/reports/${report.id}`);
  };

  const handleDownload = () => {
    const report = createReport(investigation.id);
    if (report) exportReportJson(report);
  };

  const stats: {
    label: string;
    value: number;
    tone: string;
    Icon: typeof Fingerprint;
  }[] = [
    { label: "Evidence items", value: runtime.evidence.length, tone: "text-jcyan", Icon: Fingerprint },
    { label: "Identifiers extracted", value: identifiers.length, tone: "text-jteal", Icon: Fingerprint },
    { label: "Hashes generated", value: hashed.length, tone: "text-jcyan", Icon: ShieldQuestion },
    { label: "Integrity verified", value: verified.length, tone: "text-jgreen", Icon: ShieldCheck },
  ];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="jaal-panel jaal-hud relative mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 p-4"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center border border-jgreen/50 bg-jgreen/10">
            <CheckCircle2 className="size-5 text-jgreen" />
          </span>
          <div>
            <h1 className="font-mono text-lg font-semibold uppercase tracking-[0.25em] text-jtext">
              Investigation complete
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] tracking-wider text-jcyan">
                {investigation.id}
              </span>
              <span className="border border-jborder/60 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-jmuted">
                {investigation.category}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-jmuted">
                completed {formatDateTime(completedAt)}
              </span>
            </div>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Link
            to={`/investigations/${investigation.id}`}
            className="flex items-center gap-1.5 border border-jborder/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-jmuted transition-colors hover:border-jcyan/50 hover:text-jcyan"
          >
            <ArrowLeft className="size-3" /> Back to workspace
          </Link>
        </div>
      </motion.header>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT — case summary */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="jaal-panel p-4"
        >
          <p className="jaal-label !text-jcyan">Case summary</p>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-jmuted/70">
            generated by the local analysis engine
          </p>

          <div className="mt-3 space-y-3">
            <div className="border-l-2 border-jcyan/60 bg-jcyan/[0.05] px-2.5 py-2">
              <p className="jaal-label !text-[9px]">Claimed scam scenario</p>
              <p className="mt-1 text-[11px] leading-relaxed text-jtext/90">
                {summary.scenario}
              </p>
            </div>
            <div className="border-l-2 border-jamber/60 bg-jamber/[0.05] px-2.5 py-2">
              <p className="jaal-label !text-[9px]">Manipulation tactics</p>
              <p className="mt-1 text-[11px] leading-relaxed text-jtext/90">
                {summary.tactics}
              </p>
            </div>
            <div className="border-l-2 border-jred/60 bg-jred/[0.05] px-2.5 py-2">
              <p className="jaal-label !text-[9px]">Payment request details</p>
              <p className="mt-1 text-[11px] leading-relaxed text-jtext/90">
                {summary.payment}
              </p>
            </div>
            <div>
              <p className="jaal-label !text-[9px] mb-1.5">Important moments</p>
              {summary.moments.length === 0 ? (
                <p className="text-[11px] text-jmuted">No stage moments recorded.</p>
              ) : (
                <ul className="space-y-1.5">
                  {summary.moments.map((m, i) => (
                    <li
                      key={i}
                      className="border border-jborder/50 bg-jsurface px-2.5 py-1.5"
                    >
                      <p className="font-mono text-[9px] uppercase tracking-wider text-jamber">
                        {m.label} · {formatClock(m.timestamp)}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-jtext/85">
                        “{m.text}”
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </motion.section>

        {/* CENTER — investigation timeline */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="jaal-panel p-4"
        >
          <p className="jaal-label !text-jcyan">Investigation timeline</p>
          <ol className="mt-3 space-y-2">
            {runtime.stages.map((stage) => {
              const msg = runtime.messages.find((m) =>
                stage.messageIds.includes(m.id),
              );
              const tacticNames = stage.tactics.map(
                (t) => TACTIC_META[t]?.name ?? t,
              );
              return (
                <li
                  key={stage.id}
                  className={`border px-3 py-2 ${
                    stage.status === "active"
                      ? "border-jamber/50 bg-jamber/[0.07]"
                      : stage.status === "pending"
                        ? "border-jborder/50 opacity-60"
                        : "border-jteal/40 bg-jteal/[0.05]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-jcyan">
                      0{stage.number}
                    </span>
                    <span className="text-xs font-semibold text-jtext">
                      {stage.label}
                    </span>
                    <Chip
                      tone={STAGE_STATUS_TONE[stage.status]}
                      className="ml-auto !px-1.5 !text-[8px]"
                    >
                      {stage.status}
                    </Chip>
                  </div>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-jmuted">
                    {stage.detectedAt ? formatDateTime(stage.detectedAt) : "not detected"}
                  </p>
                  {msg && (
                    <p className="mt-1 border-l-2 border-jborder/70 pl-2 text-[10px] leading-relaxed text-jtext/80">
                      “{msg.text.slice(0, 130)}
                      {msg.text.length > 130 ? "…" : ""}”
                    </p>
                  )}
                  {tacticNames.length > 0 && (
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-jamber">
                      {Array.from(new Set(tacticNames)).join(" · ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </motion.section>

        {/* RIGHT — evidence status */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="jaal-panel p-4"
        >
          <p className="jaal-label !text-jcyan">Evidence status</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {stats.map(({ label, value, tone: Tone, Icon }) => (
              <div
                key={label}
                className="border border-jborder/60 bg-jsurface p-3"
              >
                <Icon className={`size-3.5 ${Tone}`} />
                <p className={`mt-1.5 font-mono text-xl font-semibold ${Tone}`}>
                  {value}
                </p>
                <p className="jaal-label !text-[8px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div
            className={`mt-3 flex items-start gap-2 border px-3 py-2 ${
              mismatched.length > 0
                ? "border-jred/50 bg-jred/10"
                : verified.length > 0
                  ? "border-jgreen/50 bg-jgreen/10"
                  : "border-jborder/60 bg-jsurface"
            }`}
          >
            {mismatched.length > 0 ? (
              <XCircle className="mt-0.5 size-4 shrink-0 text-jred" />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-jgreen" />
            )}
            <div>
              <p className="text-xs font-semibold text-jtext">
                {mismatched.length > 0
                  ? `${mismatched.length} hash mismatch${mismatched.length === 1 ? "" : "es"}`
                  : verified.length > 0
                    ? "All checked evidence matches its recorded hash"
                    : "Integrity verification pending"}
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-jmuted">
                Hashes verify content integrity only — not authenticity, identity
                or legal admissibility.
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <p className="jaal-label !text-[9px]">Verification breakdown</p>
            {runtime.evidence.slice(0, 8).map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-2 border border-jborder/50 bg-jsurface px-2.5 py-1.5"
              >
                <span className="truncate font-mono text-[10px] text-jtext/85">
                  {e.label}: {e.value}
                </span>
                <Chip tone={HASH_TONE[e.hashStatus]} className="!px-1.5 !text-[8px]">
                  {e.hashStatus}
                </Chip>
              </div>
            ))}
            {runtime.evidence.length === 0 && (
              <p className="text-[11px] text-jmuted">No evidence collected.</p>
            )}
          </div>
        </motion.section>
      </div>

      {/* Bottom actions */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleViewReport}
          className="flex items-center gap-2 bg-jcyan px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-background transition-colors hover:bg-jcyan/85"
        >
          <FileSignature className="size-4" /> View full report
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-2 border border-jgreen/50 bg-jgreen/10 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-jgreen transition-colors hover:bg-jgreen/20"
        >
          <Download className="size-4" /> Download report
        </button>
        <Link
          to="/dashboard"
          className="flex items-center gap-2 border border-jborder/70 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-jmuted transition-colors hover:border-jcyan/50 hover:text-jcyan"
        >
          <Home className="size-4" /> Return to dashboard
        </Link>
      </div>
    </div>
  );
}
