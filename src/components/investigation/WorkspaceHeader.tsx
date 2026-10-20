import { Chip, RUN_STATUS_TONE, STAGE_STATUS_TONE } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS } from "@/services/investigationService";
import type { CaseRunStatus, Investigation, KillChainStage } from "@/types/investigation";
import { formatElapsed } from "@/utils/formatters";
import { motion } from "framer-motion";
import {
  FileSignature,
  Flag,
  Pause,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import { useEffect, useState } from "react";

function useElapsed(startedAt: number, endedAt: number | null, running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running && endedAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [running, endedAt]);
  return formatElapsed((endedAt ?? now) - startedAt);
}

export function WorkspaceHeader({
  investigation,
  status,
  startedAt,
  endedAt,
  evidenceCount,
  activeStage,
  onPause,
  onEnd,
  onReset,
  onReport,
}: {
  investigation: Investigation;
  status: CaseRunStatus;
  startedAt: number;
  endedAt: number | null;
  evidenceCount: number;
  activeStage: KillChainStage | undefined;
  onPause: () => void;
  onEnd: () => void;
  onReset: () => void;
  onReport: () => void;
}) {
  const elapsed = useElapsed(startedAt, endedAt, status === "running");

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-jborder/70 bg-jsurface/80 px-3 py-2.5"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center border border-jamber/50 bg-jamber/10">
          <Flag className="size-4 text-jamber" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] tracking-wider text-jcyan">
              {investigation.id}
            </span>
            <span className="border border-jborder/60 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-jmuted">
              {investigation.category}
            </span>
            <Chip tone={RUN_STATUS_TONE[status]} pulse={status === "running"}>
              {status === "running" ? "simulation live" : status}
            </Chip>
          </div>
          <h1 className="mt-0.5 truncate text-sm font-semibold text-jtext sm:text-base">
            {investigation.title}
          </h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] uppercase tracking-widest text-jmuted">
        <span>
          elapsed <span className="text-jtext">{elapsed}</span>
        </span>
        <span>
          evidence{" "}
          <span className="text-jcyan">{String(evidenceCount).padStart(2, "0")}</span>
        </span>
        <span className="flex items-center gap-1.5">
          stage
          <span className={activeStage ? "text-jamber" : "text-jmuted"}>
            {activeStage ? activeStage.label : STAGE_LABELS[investigation.currentStage]}
          </span>
          {activeStage && (
            <Chip tone={STAGE_STATUS_TONE[activeStage.status]} className="!px-1.5 !text-[8px]">
              {activeStage.status}
            </Chip>
          )}
        </span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          onClick={onPause}
          disabled={status === "completed"}
          title={status === "paused" ? "Resume simulation" : "Pause simulation"}
          className="h-7 cursor-pointer gap-1.5 border border-jamber/50 bg-jamber/10 px-2.5 font-mono text-[10px] uppercase tracking-wider text-jamber hover:bg-jamber/20 hover:text-jamber disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "paused" ? <Play className="size-3" /> : <Pause className="size-3" />}
          {status === "paused" ? "Resume" : "Pause"}
        </Button>
        <Button
          size="sm"
          onClick={onEnd}
          disabled={status === "completed"}
          className="h-7 cursor-pointer gap-1.5 border border-jred/50 bg-jred/10 px-2.5 font-mono text-[10px] uppercase tracking-wider text-jred hover:bg-jred/20 hover:text-jred disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Square className="size-3" /> End
        </Button>
        <Button
          size="sm"
          onClick={onReset}
          title="Reset simulation"
          className="h-7 cursor-pointer gap-1.5 border border-jborder/70 px-2.5 font-mono text-[10px] uppercase tracking-wider text-jmuted hover:border-jcyan/50 hover:text-jcyan"
        >
          <RotateCcw className="size-3" /> Reset
        </Button>
        <Button
          size="sm"
          onClick={onReport}
          className="h-7 cursor-pointer gap-1.5 bg-jcyan px-2.5 font-mono text-[10px] uppercase tracking-wider text-background hover:bg-jcyan/85"
        >
          <FileSignature className="size-3" /> Report
        </Button>
      </div>
    </motion.header>
  );
}
