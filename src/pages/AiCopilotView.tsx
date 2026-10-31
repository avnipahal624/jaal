import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/panel";
import { AI_TONE } from "./AiActionRunner";

const SUGGESTIONS = [
  "Why was the first message flagged?",
  "What tactics are being used here?",
  "What evidence supports this?",
  "What should I investigate next?",
  "Which indicators were extracted?",
  "Summarise the conversation",
];

/** Grounded answer shape stored by `appendCopilotTurn` (see groundCopilot). */
interface MessageRef {
  messageId: string;
  quote: string;
  n: number;
}

interface EvidenceRef {
  evidenceId: string;
  alias: string;
}

interface CopilotPoint {
  text: string;
  messageRefs: MessageRef[];
  evidenceRefs: EvidenceRef[];
}

interface CopilotSections {
  answer?: string;
  points?: CopilotPoint[];
  uncertainty?: string;
  suggestedNextStep?: string;
  sufficient?: boolean;
}

interface CopilotTurn {
  id: string;
  role: string;
  content: string;
  sections: CopilotSections | null;
  status: string | null;
  error: string | null;
  at: number;
}

export function CopilotView({ caseId }: { caseId: string }) {
  const navigate = useNavigate();
  const history = useQuery(api.intelligence.copilotHistory, { caseId });
  const ask = useAction(api.intelligenceActions.copilotAskAction);
  const clear = useMutation(api.intelligence.clearCopilot);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);

  const turns = (history ?? null) as CopilotTurn[] | null;
  const lastQuestion = [...(turns ?? [])]
    .reverse()
    .find((t) => t.role === "user")?.content;

  const send = async (q: string) => {
    setSending(true);
    try {
      await ask({ caseId, question: q });
      setQuestion("");
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    void send(question);
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await clear({ caseId });
    } finally {
      setClearing(false);
    }
  };

  const failed = turns?.some((t) => t.error);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-jborder/50 px-3 py-2">
        <div>
          <h2 className="font-mono text-[12px] font-semibold text-jtext">
            Investigation Copilot
          </h2>
          <p className="font-mono text-[8px] uppercase tracking-widest text-jmuted/60">
            Read-only · grounded · conversation stays untrusted
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="font-mono text-[10px] uppercase tracking-wider text-jcyan hover:bg-jcyan/10"
            onClick={() => void send(SUGGESTIONS[0])}
            disabled={sending}
          >
            Why flagged
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={clearing || !turns?.length}
            className="font-mono text-[10px] uppercase tracking-wider text-jmuted hover:border-jred/50 hover:text-jred"
            onClick={() => void handleClear()}
          >
            {clearing ? "Clearing…" : "Clear chat"}
          </Button>
        </div>
      </div>

      {/* History */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className="flex flex-col gap-2 overflow-y-auto p-3"
          style={{ maxHeight: "60%" }}
        >
          {turns?.length ? (
            turns.map((turn) => {
              const s = turn.sections;
              return (
                <div
                  key={turn.id}
                  className={`rounded-md px-3 py-2 ${
                    turn.role === "user" ? "bg-jcyan/5" : "bg-jsurface/60"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-mono text-[8px] uppercase tracking-widest ${
                        turn.role === "user" ? "text-jcyan" : "text-jmuted/60"
                      }`}
                    >
                      {turn.role === "user" ? "INVESTIGATOR" : "COPILOT"}
                    </span>
                    {turn.status === "COMPLETED" ? (
                      <Chip
                        tone={AI_TONE.success}
                        className="font-mono text-[8px] uppercase tracking-wider"
                      >
                        answered
                      </Chip>
                    ) : turn.status === "FAILED" ? (
                      <Chip
                        tone={AI_TONE.error}
                        className="font-mono text-[8px] uppercase tracking-wider"
                      >
                        failed
                      </Chip>
                    ) : turn.status === "UNAVAILABLE" ? (
                      <Chip
                        tone={AI_TONE.attention}
                        className="font-mono text-[8px] uppercase tracking-wider"
                      >
                        unavailable
                      </Chip>
                    ) : null}
                  </div>

                  {turn.role === "user" ? (
                    <p className="mt-1 min-w-0 text-[11px] leading-relaxed text-jtext/90">
                      {turn.content}
                    </p>
                  ) : turn.error ? (
                    <p className="mt-1 min-w-0 text-[11px] leading-relaxed text-jred/80">
                      {turn.error}
                    </p>
                  ) : (
                    <>
                      {(s?.answer ?? turn.content) && (
                        <p className="mt-1 min-w-0 text-[11px] leading-relaxed text-jtext/90">
                          {s?.answer ?? turn.content}
                        </p>
                      )}

                      {s?.sufficient === false && (
                        <p className="mt-1.5 font-mono text-[9px] uppercase tracking-wider text-jamber">
                          Insufficient information in this investigation — the
                          copilot did not guess.
                        </p>
                      )}

                      {s?.points?.map((pt, i) => (
                        <div key={i} className="mt-2 border-l-2 border-jborder/60 pl-3">
                          <p className="text-[11px] leading-relaxed text-jtext/85">
                            {pt.text}
                          </p>
                          {(pt.messageRefs.length > 0 ||
                            pt.evidenceRefs.length > 0) && (
                            <div className="mt-1 flex flex-wrap gap-2">
                              {pt.messageRefs.map((r) => (
                                <button
                                  key={r.messageId}
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      `/investigations/${caseId}/intelligence?msg=${r.n}`,
                                    )
                                  }
                                  className="font-mono text-[9px] uppercase tracking-wider text-jcyan transition-colors hover:text-jcyan/60"
                                  title={r.quote}
                                >
                                  MSG #{r.n}
                                </button>
                              ))}
                              {pt.evidenceRefs.map((e) => (
                                <span
                                  key={e.evidenceId}
                                  className="border border-jteal/50 bg-jteal/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-jteal"
                                >
                                  {e.alias}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {s?.uncertainty && (
                        <p className="mt-2 font-mono text-[9px] leading-relaxed text-jmuted/70">
                          uncertain because: {s.uncertainty}
                        </p>
                      )}
                      {s?.suggestedNextStep && (
                        <p className="mt-1 font-mono text-[9px] leading-relaxed text-jamber">
                          → {s.suggestedNextStep}
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
              <p className="font-mono text-[10px] uppercase tracking-widest text-jmuted">
                Ask a question
              </p>
              <p className="font-mono text-[9px] text-jmuted/60">
                Answers cite only this case&apos;s records.
              </p>
            </div>
          )}
        </div>

        {/* Suggested questions */}
        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={sending}
              onClick={() => void send(s)}
              className="border border-jborder/50 bg-jsurface/50 px-2 py-1 text-left font-mono text-[9px] text-jmuted transition-colors hover:border-jcyan/50 hover:text-jcyan disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2 border-t border-jborder/40 p-2">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything about this investigation…"
            rows={2}
            maxLength={2_000}
            disabled={sending}
            className="min-h-0 flex-1 font-mono text-[11px] text-jtext placeholder:text-jmuted/40 focus-visible:border-jcyan/70 focus-visible:ring-jcyan/40"
          />
          <div className="flex flex-col items-end justify-between">
            <span className="font-mono text-[9px] text-jmuted/50">
              {question.length}/2000
            </span>
            <Button
              type="submit"
              disabled={sending || !question.trim()}
              className="gap-1.5 bg-jcyan text-background hover:bg-jcyan/85"
            >
              {sending ? "Sending…" : "Ask"}
            </Button>
          </div>
        </form>
        <p className="px-3 pb-2 font-mono text-[8px] uppercase tracking-widest text-jmuted/50">
          Responses are based only on this investigation&apos;s data.
        </p>
      </div>

      {failed && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-jborder/40 px-3 py-2">
          <p className="font-mono text-[9px] italic text-jamber">
            A turn could not be completed. The copilot did not guess — it
            admitted what it could not determine.
          </p>
          {lastQuestion && (
            <Button
              variant="outline"
              size="sm"
              disabled={sending}
              className="font-mono text-[10px] uppercase tracking-wider text-jcyan hover:border-jcyan/60"
              onClick={() => void send(lastQuestion)}
            >
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
