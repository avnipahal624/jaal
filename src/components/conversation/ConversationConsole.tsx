import { MessageComposer } from "@/components/conversation/MessageComposer";
import { MessageRow, TypingIndicator } from "@/components/conversation/MessageRow";
import { Chip, RUN_STATUS_TONE } from "@/components/ui/panel";
import { useJaal } from "@/state/JaalProvider";
import { useSimulation } from "@/hooks/useSimulation";
import type { CaseRuntime, Investigation } from "@/types/investigation";
import { ArrowDown, FileStack, RotateCcw, ScrollText } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Hacker-style conversation terminal: dense rows, mono metadata, live status.
 * Messages arrive dynamically through the local simulation engine.
 */
export function ConversationConsole({
  investigation,
  runtime,
  onGenerateReport,
  highlightId,
}: {
  investigation: Investigation;
  runtime: CaseRuntime;
  onGenerateReport: () => void;
  /** Scroll to + flash this message (evidence “open source” action). */
  highlightId?: string | null;
}) {
  const { ingestTranscript, notify } = useJaal();
  const { send, pause, reset, isRunning, isPaused, isCompleted, isTyping, suggestions } =
    useSimulation(investigation.id);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  const messages = runtime.messages;

  useEffect(() => {
    if (!stickToBottom) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, isTyping, stickToBottom]);

  // Evidence → "open source message" jumps here.
  useEffect(() => {
    if (!highlightId) return;
    setStickToBottom(false);
    const t = window.setTimeout(() => {
      document
        .getElementById(`msg-${highlightId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [highlightId]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setStickToBottom(atBottom);
  };

  const scrollToLatest = () => {
    setStickToBottom(true);
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    const raw = await file.text();
    const count = ingestTranscript(investigation.id, raw);
    if (count === 0) {
      notify({
        title: "Transcript not parsed",
        detail: "Use lines in the form “Name: message”.",
        caseId: investigation.id,
        kind: "system",
      });
    }
  };

  const pasteImport = () => {
    const sample = window.prompt(
      "Paste transcript lines (form: “Scammer: …” / “Me: …”):",
    );
    if (!sample) return;
    ingestTranscript(investigation.id, sample);
  };

  const scammerCount = messages.filter((m) => m.author === "scammer").length;
  const decoyCount = messages.filter((m) => m.author === "decoy").length;

  return (
    <section className="jaal-panel jaal-hud relative flex min-h-0 flex-col">
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-jborder/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <ScrollText className="size-3.5 shrink-0 text-jcyan" />
          <p className="jaal-label">Conversation console</p>
          <Chip tone={RUN_STATUS_TONE[runtime.status]} pulse={isRunning}>
            {runtime.status}
          </Chip>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[9px] uppercase tracking-widest text-jmuted sm:inline">
            {scammerCount} suspect · {decoyCount} decoy
          </span>
          <button
            type="button"
            onClick={pasteImport}
            title="Paste transcript"
            className="flex size-6 items-center justify-center border border-jborder/70 text-jmuted transition-colors hover:border-jcyan/50 hover:text-jcyan"
          >
            <FileStack className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={reset}
            title="Clear simulation (reset)"
            className="flex size-6 items-center justify-center border border-jborder/70 text-jmuted transition-colors hover:border-jred/60 hover:text-jred"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative min-h-0 flex-1 overflow-y-auto px-2 py-2"
      >
        <div className="jaal-grid-fine pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative space-y-1.5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-sm text-jmuted">
                No messages in this session yet.
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-jmuted/60">
                Reset the simulation to seed the opening line
              </p>
            </div>
          )}
          {messages.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              highlight={highlightId === m.id}
            />
          ))}
          {isTyping && <TypingIndicator />}
        </div>

        {!stickToBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={scrollToLatest}
            className="sticky bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 border border-jcyan/50 bg-jsurface px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-jcyan shadow-lg transition-colors hover:bg-jcyan/15"
          >
            <ArrowDown className="size-3" /> latest
          </button>
        )}
      </div>

      {/* Completion banner */}
      {isCompleted && (
        <div className="shrink-0 border-t border-jgreen/40 bg-jgreen/10 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-jgreen">
                Simulation complete
              </p>
              <p className="text-[10px] text-jmuted">
                Script exhausted — all evidence preserved below.
              </p>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1 border border-jgreen/50 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-jgreen transition-colors hover:bg-jgreen/15"
              >
                <RotateCcw className="size-3" /> Restart
              </button>
              <button
                type="button"
                onClick={onGenerateReport}
                className="border border-jcyan/50 bg-jcyan/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-jcyan transition-colors hover:bg-jcyan/20"
              >
                Generate report
              </button>
            </div>
          </div>
        </div>
      )}

      {isPaused && !isCompleted && (
        <div className="shrink-0 border-t border-jamber/40 bg-jamber/10 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-jamber">
              Simulation paused — conversation frozen.
            </p>
            <button
              type="button"
              onClick={pause}
              className="border border-jamber/50 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-jamber transition-colors hover:bg-jamber/15"
            >
              Resume
            </button>
          </div>
        </div>
      )}

      <MessageComposer
        disabled={isPaused || isCompleted}
        disabledReason={
          isCompleted
            ? "Script exhausted. Restart the simulation to continue, or generate the report."
            : "Simulation paused — resume to send the next decoy reply."
        }
        suggestions={suggestions}
        busy={isTyping}
        onSend={(text) => void send(text)}
        onImport={handleImport}
      />
    </section>
  );
}
