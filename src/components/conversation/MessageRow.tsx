import { cn } from "@/lib/utils";
import type { ConversationMessage } from "@/types/message";
import { formatClock } from "@/utils/formatters";
import { motion } from "framer-motion";
import { Bot, ShieldAlert, Terminal } from "lucide-react";

/**
 * One line in the investigation terminal. Scammer lines carry muted red/amber
 * accents, decoy lines carry cyan/teal. Deliberately dense and technical —
 * not a chat bubble app.
 */
export function MessageRow({
  message,
  highlight = false,
  number,
}: {
  message: ConversationMessage;
  highlight?: boolean;
  /** Position in the conversation, shown as MSG #NN */
  number?: number;
}) {
  if (message.author === "system") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="my-2 flex items-center gap-2"
      >
        <span className="h-px flex-1 bg-jborder/60" />
        <span className="flex items-center gap-1.5 border border-jborder/70 bg-jsurface px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-jmuted">
          <Terminal className="size-3" /> {message.text}
        </span>
        <span className="h-px flex-1 bg-jborder/60" />
      </motion.div>
    );
  }

  const isScammer = message.author === "scammer";

  return (
    <motion.article
      id={`msg-${message.id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "group relative scroll-mt-4 border-l-2 py-1.5 pl-3 pr-2 transition-colors",
        highlight
          ? "bg-jamber/[0.07] ring-1 ring-jamber/70"
          : "hover:bg-white/[0.02]",
        isScammer ? "border-l-jred/70" : "border-l-jcyan/70",
      )}
    >
      <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {number !== undefined && (
          <span className="border border-jborder/70 bg-jsurface px-1.5 py-px font-mono text-[9px] tracking-wider text-jmuted">
            MSG #{String(number).padStart(2, "0")}
          </span>
        )}
        <span
          className={cn(
            "flex size-5 items-center justify-center border",
            isScammer
              ? "border-jred/50 bg-jred/10 text-jred"
              : "border-jcyan/50 bg-jcyan/10 text-jcyan",
          )}
        >
          {isScammer ? (
            <ShieldAlert className="size-3" />
          ) : (
            <Bot className="size-3" />
          )}
        </span>
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-[0.18em]",
            isScammer ? "text-jred/90" : "text-jcyan",
          )}
        >
          {isScammer ? "Suspect / scammer" : "JAAL AI-decoy"}
        </span>
        <span className="font-mono text-[9px] text-jmuted/70">
          {formatClock(message.timestamp)}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-jmuted/50">
          {message.source}
        </span>
        {message.author === "decoy" && message.status && (
          <span className="border border-jteal/40 bg-jteal/10 px-1.5 py-px font-mono text-[8px] uppercase tracking-widest text-jteal">
            {message.status}
          </span>
        )}
      </div>
      <p
        className={cn(
          "whitespace-pre-wrap break-words text-[13px] leading-relaxed",
          isScammer ? "text-jtext/90" : "text-jtext",
        )}
      >
        {message.text}
      </p>
    </motion.article>
  );
}

export function TypingIndicator({ who = "scammer" }: { who?: string }) {
  return (
    <div className="flex items-center gap-2 py-2 pl-3">
      <span className="flex size-5 items-center justify-center border border-jred/50 bg-jred/10 text-jred">
        <ShieldAlert className="size-3" />
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-jred/90">
        {who === "scammer" ? "Suspect is typing" : "Decoy is drafting"}
      </span>
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1 bg-jred/70 jaal-pulse"
            style={{ animationDelay: `${i * 0.22}s` }}
          />
        ))}
      </span>
    </div>
  );
}
