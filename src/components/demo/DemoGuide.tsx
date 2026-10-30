import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useJaal } from "@/state/JaalProvider";
import { Check, ChevronRight, ListChecks, Play, X } from "lucide-react";

interface Stage {
  window: string;
  title: string;
  /** What the presenter should point at. */
  show: string;
  /** True only when the real records needed to demo it already exist. */
  ready: boolean;
  /** What is actually missing — shown instead of faking progress. */
  awaiting?: string;
  href: string;
}

/**
 * Guided 90-second demo.
 *
 * Every stage is bound to real records in the current session — messages,
 * evidence, tactics, hashes and reports that actually exist. A stage that has
 * no data behind it says so rather than ticking green, so the walkthrough can
 * never present a capability the app does not have.
 */
export function DemoGuide() {
  const [open, setOpen] = useState(false);
  const { state } = useJaal();
  const navigate = useNavigate();
  const location = useLocation();

  const { investigations, sessions, reports } = state;

  const stages = useMemo<Stage[]>(() => {
    const activeCase =
      investigations.find((i) => i.status === "active") ?? investigations[0] ?? null;
    const rt = activeCase ? sessions[activeCase.id] : undefined;

    const messageCount = rt?.messages.length ?? 0;
    const evidenceCount = rt?.evidence.length ?? 0;
    const hashedCount =
      rt?.evidence.filter((e) => e.hashStatus !== "none").length ?? 0;
    const tacticCount = rt?.tactics.length ?? 0;
    const completedStages =
      rt?.stages.filter((s) => s.status === "completed").length ?? 0;

    const caseHref = activeCase ? `/investigations/${activeCase.id}` : "/investigations";
    const hasCase = investigations.length > 0;

    return [
      {
        window: "00:00–00:10",
        title: "Open JAAL — the investigation workspace",
        show:
          "Orient on the three panels: conversation on the left, investigation progress in the centre, extracted evidence on the right. Point out the SIMULATION MODE label.",
        ready: true,
        href: "/dashboard",
      },
      {
        window: "00:10–00:25",
        title: "Launch a synthetic digital-arrest scenario",
        show:
          "Create a case from the wizard using obviously synthetic data — an urgent legal threat with no real contact details.",
        ready: hasCase,
        awaiting: "No case created yet — start one from New Investigation.",
        href: "/investigations/new",
      },
      {
        window: "00:25–00:45",
        title: "Decoy conversation and identifier extraction",
        show:
          "Show JAAL responding as a believable, slightly confused victim, then the potential indicators extracted from those messages.",
        ready: messageCount >= 3 && evidenceCount > 0,
        awaiting:
          hasCase
            ? `${messageCount} message(s), ${evidenceCount} indicator(s) recorded — run the conversation further.`
            : "No case with a conversation yet.",
        href: caseHref,
      },
      {
        window: "00:45–01:00",
        title: "Tactic classification and kill-chain progression",
        show:
          "Walk the detected tactics and the stage progression derived from real message content — rule-based, not model output.",
        ready: tacticCount > 0 && completedStages >= 1,
        awaiting: `${tacticCount} tactic(s), ${completedStages} completed stage(s) — detection runs as messages arrive.`,
        href: caseHref,
      },
      {
        window: "01:00–01:15",
        title: "Generate a hash and inspect integrity status",
        show:
          "Hash an evidence item, then show the status ladder: NOT HASHED → HASH GENERATED → INTEGRITY VERIFIED, plus mismatch and tamper simulation.",
        ready: hashedCount > 0,
        awaiting: `${hashedCount} hashed item(s) — generate a hash from the evidence drawer.`,
        href: "/evidence",
      },
      {
        window: "01:15–01:30",
        title: "Generate and open the investigation report",
        show:
          "Produce the report and open it, separating conversation facts, rule-based findings, AI-assisted output and human notes.",
        ready: reports.length > 0,
        awaiting: `${reports.length} report(s) — generate one from the completed case.`,
        href: "/reports",
      },
    ];
  }, [investigations, sessions, reports]);

  const readyCount = stages.filter((s) => s.ready).length;
  const allReady = readyCount === stages.length;

  return (
    <div className="jaal-no-print fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="w-[min(92vw,26rem)] border border-jborder/70 bg-jsurface shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-jborder/70 bg-jsurface/90 px-3 py-2">
            <div className="min-w-0">
              <p className="jaal-label">Demo guide · 90 seconds</p>
              <p className="truncate font-mono text-[10px] text-jmuted/70">
                {readyCount}/{stages.length} stages have real data to show
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close demo guide"
              className="flex size-6 shrink-0 items-center justify-center border border-jborder/70 text-jmuted transition-colors hover:border-jcyan/60 hover:text-jcyan"
            >
              <X className="size-3" />
            </button>
          </div>

          <ol className="max-h-[60vh] overflow-y-auto">
            {stages.map((s, i) => {
              const isHere = location.pathname === s.href;
              return (
                <li key={s.title} className="border-b border-jborder/50 last:border-0">
                  <button
                    type="button"
                    onClick={() => navigate(s.href)}
                    className={cn(
                      "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-jcyan/5",
                      isHere && "bg-jcyan/5",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center border",
                        s.ready
                          ? "border-jgreen/60 bg-jgreen/15 text-jgreen"
                          : "border-jborder/70 bg-jsurface text-jmuted/60",
                      )}
                      aria-hidden
                    >
                      {s.ready ? (
                        <Check className="size-2.5" />
                      ) : (
                        <span className="font-mono text-[8px]">{i + 1}</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-jcyan">
                          {s.window}
                        </span>
                        <span
                          className={cn(
                            "font-mono text-[8px] uppercase tracking-widest",
                            s.ready ? "text-jgreen" : "text-jamber",
                          )}
                        >
                          {s.ready ? "ready" : "awaiting data"}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[12px] font-medium leading-snug text-jtext">
                        {s.title}
                      </span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-jmuted/80">
                        {s.show}
                      </span>
                      {!s.ready && s.awaiting && (
                        <span className="mt-1 block font-mono text-[10px] leading-relaxed text-jamber">
                          → {s.awaiting}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="mt-1 size-3 shrink-0 text-jmuted/50" />
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="border-t border-jborder/70 px-3 py-2.5">
            <p className="text-[11px] leading-relaxed text-jmuted/80">
              Each step drives real functionality — nothing here is scripted.
              A stage reads <span className="text-jamber">awaiting data</span>{" "}
              when the underlying record does not exist yet.
            </p>
            <p className="mt-1.5 font-mono text-[9px] uppercase tracking-widest text-jmuted/60">
              Simulated interactions only · no real scammers contacted
            </p>
            <Button
              size="sm"
              onClick={() => {
                setOpen(false);
                navigate(stages.find((s) => !s.ready)?.href ?? "/dashboard");
              }}
              className="mt-2 w-full gap-1.5 bg-jcyan font-mono text-[10px] uppercase tracking-wider text-background hover:bg-jcyan/85"
            >
              <Play className="size-3" />
              {allReady ? "Replay from the top" : "Go to next stage"}
            </Button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] shadow-lg transition-colors",
          allReady
            ? "border-jgreen/60 bg-jgreen/10 text-jgreen hover:bg-jgreen/20"
            : "border-jcyan/60 bg-jcyan/10 text-jcyan hover:bg-jcyan/20",
        )}
      >
        {open ? <X className="size-3" /> : <ListChecks className="size-3" />}
        Demo guide
        <span className="border-l border-current pl-2 opacity-70">
          {readyCount}/{stages.length}
        </span>
      </button>
    </div>
  );
}
