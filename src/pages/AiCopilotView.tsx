import { useQuery } from "convex/react";
import { action } from "convex/server";
import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatClock } from "@/utils/formatters";

const SUGGESTIONS = [
  "Why was the first message flagged?",
  "What tactics are being used here?",
  "What evidence supports this?",
  "What should I investigate next?",
  "Which indicators were extracted?",
  "Summarise the conversation",
];

export function CopilotView({ caseId }: { caseId: string }) {
  const navigate = useNavigate();
  const history = useQuery(api.intelligence.copilotHistory, { caseId });
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);

  const send = async (q: string) => {
    const res = await convex.action(api.intelligence.copilotAsk, { caseId, question: q });
    setQuestion("");
    setSending(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    send(question);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-jborder/50 px-3 py-2">
        <div>
          <h2 className="font-mono text-[12px] font-semibold text-jtext">Investigation Copilot</h2>
          <p className="font-mono text-[8px] uppercase tracking-widest text-jmuted/60">
            Read-only · grounded · conversation stays untrusted
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="font-mono text-[10px] uppercase tracking-wider text-jcyan hover:bg-jcyan/10"
          onClick={() => send(SUGGESTIONS[0])}
        >
          <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12l2.5 2.5L16 6" />
          </svg>
          Why flagged
        </Button>
      </div>

      {/* History */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-col gap-2 overflow-y-auto p-3" style={{ maxHeight: "60%" }}>
          {history?.map((turn: any) => (
            <div
              key={turn.id}
              className={`flex gap-2.5 rounded-md px-3 py-2 ${
                turn.role === "user" ? "bg-jcyan/5" : "bg-jsurface/60"
              }`}
            >
              <div className="flex shrink-0 items-center gap-2">
                <span className={`font-mono text-[8px] uppercase tracking-widest ${turn.role === "user" ? "text-jcyan" : "text-jmuted/60"}`}>
                  {turn.role === "user" ? "INVESTIGATOR" : "COPILOT"}
                </span>
                {turn.status === "COMPLETED" ? (
                  <Badge tone="success" className="font-mono text-[8px] uppercase tracking-wider">d</Badge>
                ) : turn.status === "FAILED" ? (
                  <Badge tone="error" className="font-mono text-[8px] uppercase tracking-wider">f</Badge>
                ) : turn.status === "UNAVAILABLE" ? (
                  <Badge tone="attention" className="font-mono text-[8px] uppercase tracking-wider">u</Badge>
                ) : null}
              </div>
              {turn.role === "user" ? (
                <p className="min-w-0 flex-1 text-[11px] text-jtext/90">{turn.content}</p>
              ) : turn.error ? (
                <p className="min-w-0 flex-1 text-[11px] text-jred/80">{turn.error}</p>
              ) : turn.sections?.answer ? (
                <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-jtext/90">{turn.sections.answer}</p>
              ) : turn.content ? (
                <p className="min-w-0 flex-1 text-[11px] text-jmuted/80">{turn.content}</p>
              ) : null}
              {turn.sections?.answer && turn.sections.points?.map((pt: any, i: number) => (
                <div key={i} className="ml-5 flex min-w-0 flex-wrap gap-2">
                  <Badge tone="neutral" className="font-mono text-[8px] uppercase tracking-wider">
                    {pt.text?.slice(0, 60)}
                  </Badge>
                  {pt.messageRefs?.map((r: any) => (
                    <button
                      key={r.messageId}
                      type="button"
                      onClick={() => navigate(`/investigations/${caseId}/intelligence?msg=${r.n ?? ""}`)}
                      className="font-mono text-[9px] uppercase tracking-wider text-jcyan transition-colors hover:text-jcyan/60"
                    >
                      MSG #{r.n}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )) || (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
              <svg className="size-6 text-jmuted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="font-mono text-[10px] uppercase tracking-widest text-jmuted">Ask a question</p>
              <p className="font-mono text-[9px] text-jmuted/60">Keep it under 2,000 characters.</p>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2 border-t border-jborder/40 p-2">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything about this case…"
            rows={2}
            maxLength={2_000}
            disabled={sending}
            className="min-h-0 flex-1 font-mono text-[11px] text-jtext placeholder:text-jmuted/40 focus-visible:border-jcyan/70 focus-visible:ring-jcyan/40"
          />
          <Button
            type="submit"
            disabled={sending || !question.trim()}
            className="gap-1.5 bg-jcyan text-background hover:bg-jcyan/85"
          >
            <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-5 5m5-5l5 5" />
            </svg>
            {sending ? "Sending…" : "Ask"}
          </Button>
        </form>
      </div>

      {history?.some((t: any) => t.error) && (
        <p className="font-mono text-[9px] italic text-jamber">The last turn could not be completed. The copilot did not guess — it admitted what it could not determine.</p>
      )}
    </div>
  );
}
