import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Chip, STAGE_STATUS_TONE } from "@/components/ui/panel";
import { TACTIC_META } from "@/services/investigationService";
import { cn } from "@/lib/utils";
import type {
  DetectedTactic,
  KillChainStage,
} from "@/types/investigation";
import type { ConversationMessage } from "@/types/message";
import { formatDateTime } from "@/utils/formatters";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  IndianRupee,
  MessageSquare,
  MonitorSmartphone,
  Siren,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

const STAGE_ICON: Record<string, LucideIcon> = {
  contact: MessageSquare,
  authority: BadgeCheck,
  fear: Siren,
  payment: IndianRupee,
  exploit: MonitorSmartphone,
};

export function KillChainPanel({
  stages,
  messages,
  tactics,
}: {
  stages: KillChainStage[];
  messages: ConversationMessage[];
  tactics: DetectedTactic[];
}) {
  const [openStage, setOpenStage] = useState<KillChainStage | null>(null);

  return (
    <>
      <ol className="relative flex flex-col gap-1 p-2">
        {/* Connector */}
        <div className="absolute bottom-4 left-[22px] top-4 w-px bg-gradient-to-b from-jcyan/50 via-jborder to-transparent" />

        {stages.map((stage, i) => {
          const Icon = STAGE_ICON[stage.id] ?? MessageSquare;
          const isActive = stage.status === "active";
          const isDone = stage.status === "completed" || stage.status === "detected";
          return (
            <motion.li
              key={stage.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
              className="relative"
            >
              <button
                type="button"
                onClick={() => setOpenStage(stage)}
                className={cn(
                  "flex w-full items-start gap-2.5 border px-2 py-2 text-left transition-colors",
                  isActive
                    ? "border-jamber/60 bg-jamber/10 shadow-[0_0_14px_-6px_rgba(255,170,69,0.7)]"
                    : isDone
                      ? "border-jteal/35 bg-jteal/[0.06] hover:border-jteal/60"
                      : "border-jborder/50 bg-jsurface/60 opacity-60 hover:opacity-90",
                )}
              >
                <span
                  className={cn(
                    "relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center border bg-background",
                    isActive
                      ? "border-jamber/70 text-jamber"
                      : isDone
                        ? "border-jteal/60 text-jteal"
                        : "border-jborder text-jmuted/60",
                  )}
                >
                  <Icon className="size-3.5" />
                  {isActive && (
                    <span className="absolute -right-1 -top-1 size-1.5 bg-jamber jaal-pulse" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-[11px] font-semibold",
                        isActive ? "text-jamber" : isDone ? "text-jtext" : "text-jmuted",
                      )}
                    >
                      {stage.number}. {stage.label}
                    </span>
                    <Chip
                      tone={STAGE_STATUS_TONE[stage.status]}
                      className="!px-1.5 !text-[8px]"
                    >
                      {stage.status}
                    </Chip>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[9px] uppercase tracking-wider text-jmuted/70">
                    <span>
                      {stage.detectedAt ? formatDateTime(stage.detectedAt) : "not detected"}
                    </span>
                    <span>· {stage.messageIds.length} msg</span>
                    <span>· {stage.tactics.length} tactics</span>
                  </span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </ol>

      {/* Stage detail */}
      <Dialog open={openStage !== null} onOpenChange={(o) => !o && setOpenStage(null)}>
        <DialogContent className="max-w-lg border-jborder/80 bg-popover">
          {openStage && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-jtext">
                  <span className="font-mono text-jcyan">
                    0{openStage.number}
                  </span>
                  {openStage.label}
                  <Chip tone={STAGE_STATUS_TONE[openStage.status]}>
                    {openStage.status}
                  </Chip>
                </DialogTitle>
                <DialogDescription className="text-jmuted">
                  {openStage.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="border border-jborder/70 bg-jsurface p-3">
                  <p className="jaal-label">Why this stage was identified</p>
                  <p className="mt-1 text-xs leading-relaxed text-jtext">
                    {openStage.reason ||
                      "No message content has yet matched this stage's detection pattern."}
                  </p>
                  {openStage.detectedAt && (
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-jmuted">
                      detected {formatDateTime(openStage.detectedAt)}
                    </p>
                  )}
                </div>

                <div>
                  <p className="jaal-label mb-1.5">Associated messages</p>
                  {openStage.messageIds.length === 0 ? (
                    <p className="text-xs text-jmuted">
                      No messages linked to this stage yet.
                    </p>
                  ) : (
                    <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                      {messages
                        .filter((m) => openStage.messageIds.includes(m.id))
                        .map((m) => (
                          <li
                            key={m.id}
                            className="border-l-2 border-jred/60 bg-jred/[0.05] px-2 py-1.5"
                          >
                            <p className="font-mono text-[9px] uppercase tracking-widest text-jmuted">
                              {m.author} · {formatDateTime(m.timestamp)}
                            </p>
                            <p className="mt-0.5 line-clamp-3 text-[11px] text-jtext/90">
                              {m.text}
                            </p>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="jaal-label mb-1.5">Detected tactics here</p>
                  {openStage.tactics.length === 0 ? (
                    <p className="text-xs text-jmuted">No tactics recorded for this stage.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {openStage.tactics.map((t) => (
                        <Chip key={t} tone="border-jamber/50 bg-jamber/10 text-jamber">
                          {TACTIC_META[t]?.name ?? t}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>

                {tactics.length > 0 && (
                  <p className="font-mono text-[9px] uppercase tracking-widest text-jmuted/60">
                    {tactics.length} tactic detections total in this session
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
