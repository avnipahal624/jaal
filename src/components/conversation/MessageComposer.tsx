import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Loader2, Paperclip, Play, SendHorizonal } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export function MessageComposer({
  disabled,
  disabledReason,
  suggestions,
  onSend,
  onImport,
  busy,
}: {
  disabled: boolean;
  disabledReason?: string;
  suggestions: readonly string[];
  onSend: (text: string) => void;
  onImport: (file: File | undefined) => void;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || busy) return;
    onSend(trimmed);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="shrink-0 border-t border-jborder/60 bg-jsurface/70 p-2">
      {disabled ? (
        <div className="flex items-center gap-2 border border-jamber/40 bg-jamber/10 px-3 py-2">
          <span className="size-1.5 bg-jamber jaal-pulse" />
          <p className="text-[11px] text-jamber">{disabledReason}</p>
        </div>
      ) : (
        <>
          {/* Small contextual suggestion area — the strategy panel is the
              main place to review and approve suggested questions. */}
          {suggestions.length > 0 && (
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="hidden shrink-0 font-mono text-[8px] uppercase tracking-widest text-jmuted/60 sm:inline">
                contextual
              </span>
              {suggestions.slice(0, 2).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!busy) onSend(s);
                  }}
                  title={s}
                  className="min-w-0 max-w-[48%] truncate border border-jborder/70 bg-jsurface px-2 py-0.5 text-[10px] text-jmuted transition-colors hover:border-jcyan/50 hover:text-jcyan disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Play className="mr-1 inline size-2 text-jcyan" />
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-1.5">
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.text,text/plain"
              className="hidden"
              onChange={(e) => {
                onImport(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Import transcript (.txt)"
              onClick={() => fileRef.current?.click()}
              className="size-9 shrink-0 cursor-pointer border-jborder/70 text-jmuted hover:border-jcyan/50 hover:text-jcyan"
            >
              <Paperclip className="size-4" />
            </Button>
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder="Draft the decoy reply… (Enter to send · Shift+Enter for newline)"
              className={cn(
                "min-h-[44px] resize-none border-jborder/70 bg-jsurface text-[13px] text-jtext",
                "placeholder:text-jmuted/50 focus-visible:border-jcyan/70 focus-visible:ring-jcyan/40",
              )}
            />
            <Button
              type="button"
              onClick={submit}
              disabled={busy || text.trim().length === 0}
              size="icon"
              title="Send decoy message"
              className="size-9 shrink-0 cursor-pointer bg-jcyan text-background hover:bg-jcyan/85 disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SendHorizonal className="size-4" />
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
