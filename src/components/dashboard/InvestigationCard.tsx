import {
  Chip,
  INVESTIGATION_STATUS_STYLE,
  STAGE_TONE,
} from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS } from "@/services/investigationService";
import type { Investigation } from "@/types/investigation";
import { relativeTime, truncate } from "@/utils/formatters";
import { ArrowUpRight, Fingerprint, Layers } from "lucide-react";
import { Link } from "react-router";

const CATEGORY_TONE: Record<string, string> = {
  "Digital arrest scam": "border-jred/40 text-jred",
  "UPI/payment scam": "border-jamber/40 text-jamber",
  Phishing: "border-jcyan/40 text-jcyan",
  Impersonation: "border-jteal/40 text-jteal",
  "Job scam": "border-jamber/40 text-jamber",
  "Investment scam": "border-jred/40 text-jred",
  Other: "border-jborder text-jmuted",
};

export function InvestigationCard({
  investigation,
  evidenceCount,
  stageId,
}: {
  investigation: Investigation;
  evidenceCount: number;
  stageId: Investigation["currentStage"];
}) {
  const link = `/investigations/${investigation.id}`;
  return (
    <article className="jaal-panel jaal-hud group relative flex flex-col gap-3 p-4 transition-colors hover:border-jcyan/50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-wider text-jcyan">
            {investigation.id}
          </p>
          <h3 className="mt-1 truncate text-sm font-semibold text-jtext">
            {investigation.title}
          </h3>
        </div>
        <Chip style={INVESTIGATION_STATUS_STYLE[investigation.status]}>
          {investigation.status}
        </Chip>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
            CATEGORY_TONE[investigation.category] ?? "border-jborder text-jmuted"
          }`}
        >
          {investigation.category}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-jmuted">
          stage · <span className={STAGE_TONE[stageId]}>{STAGE_LABELS[stageId]}</span>
        </span>
      </div>

      <p className="text-[11px] leading-relaxed text-jmuted">
        {truncate(investigation.description, 110)}
      </p>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-jborder/60 pt-3">
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-jmuted">
          <span className="flex items-center gap-1">
            <Fingerprint className="size-3 text-jcyan" /> {evidenceCount}
          </span>
          <span className="flex items-center gap-1">
            <Layers className="size-3 text-jteal" />{" "}
            {investigation.lastActivityAt ? relativeTime(investigation.lastActivityAt) : "—"}
          </span>
        </div>
        <Button
          asChild
          size="sm"
          className="h-7 cursor-pointer gap-1 bg-jcyan/15 px-2.5 font-mono text-[11px] uppercase tracking-wider text-jcyan hover:bg-jcyan/25 hover:text-jcyan"
        >
          <Link to={link}>
            Open <ArrowUpRight className="size-3" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
