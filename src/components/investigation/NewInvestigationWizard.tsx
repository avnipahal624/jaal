import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { useJaal } from "@/state/JaalProvider";
import type { CreateCaseInput } from "@/state/JaalProvider";
import { SCAM_CATEGORIES, type DetectionMode, type ScamCategory } from "@/types/investigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cpu,
  FileText,
  MessageSquare,
  Radio,
  Sparkles,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";

const STEPS = [
  { id: 1, label: "Case information" },
  { id: 2, label: "Conversation source" },
  { id: 3, label: "Configuration" },
  { id: 4, label: "Start investigation" },
];

const INIT_SEQUENCE = [
  "Allocating case identifier…",
  "Loading synthetic conversation script…",
  "Arming tactic detection engine…",
  "Preparing identifier extraction…",
  "Opening investigation workspace…",
];

type Source = "simulation" | "paste" | "import";

export function NewInvestigationWizard() {
  const { state, createCase } = useJaal();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"form" | "initializing">("form");
  const [initIndex, setInitIndex] = useState(0);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ScamCategory>(
    state.settings.investigation.defaultCategory,
  );
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const [source, setSource] = useState<Source>("simulation");
  const [transcript, setTranscript] = useState("");

  const [detectionMode, setDetectionMode] = useState<DetectionMode>(
    state.settings.investigation.defaultDetectionMode,
  );
  const [tacticDetection, setTacticDetection] = useState(true);
  const [identifierExtraction, setIdentifierExtraction] = useState(
    state.settings.investigation.autoExtract,
  );
  const [integrityHashing, setIntegrityHashing] = useState(
    state.settings.investigation.autoHash,
  );

  const next = () => {
    setError(null);
    if (step === 1) {
      if (title.trim().length < 3) {
        setError("Give the investigation a title (at least 3 characters).");
        return;
      }
      if (description.trim().length < 10) {
        setError("Add a short case description so reports have context.");
        return;
      }
    }
    if (step === 2 && source !== "simulation" && transcript.trim().length < 10) {
      setError("Paste at least one message line (e.g. “Scammer: …”).");
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setTranscript(text);
    setError(null);
  };

  const start = async () => {
    setPhase("initializing");
    setInitIndex(0);
    for (let i = 0; i < INIT_SEQUENCE.length; i++) {
      setInitIndex(i);
      await new Promise((r) => setTimeout(r, 340));
    }
    const input: CreateCaseInput = {
      title: title.trim(),
      category,
      description: description.trim(),
      notes: notes.trim(),
      source,
      detectionMode,
      flags: { tacticDetection, identifierExtraction, integrityHashing },
      transcript: source === "simulation" ? undefined : transcript,
    };
    const caseId = createCase(input);
    navigate(`/investigations/${caseId}`);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <p className="jaal-label">Case creation · controlled simulation</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-jtext sm:text-3xl">
          New investigation
        </h1>
        <p className="mt-1 text-sm text-jmuted">
          JAAL never contacts real people. The conversation source is always a
          synthetic, locally simulated transcript.
        </p>
      </header>

      {/* Step indicator */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((s) => (
          <div
            key={s.id}
            className={cn(
              "border px-3 py-2 transition-colors",
              step === s.id
                ? "border-jcyan/60 bg-jcyan/10"
                : step > s.id
                  ? "border-jteal/40 bg-jteal/5"
                  : "border-jborder/60 bg-jsurface",
            )}
          >
            <p
              className={cn(
                "font-mono text-[10px] uppercase tracking-widest",
                step === s.id ? "text-jcyan" : step > s.id ? "text-jteal" : "text-jmuted/60",
              )}
            >
              {step > s.id ? "✓ " : `0${s.id} · `}
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="jaal-panel jaal-hud relative p-5">
        <AnimatePresence mode="wait">
          {phase === "form" ? (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.22 }}
            >
              {/* STEP 1 */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="title" className="jaal-label">
                      Investigation title
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Digital arrest scam — parcel flag"
                      className="border-jborder/70 bg-jsurface text-jtext placeholder:text-jmuted/50 focus-visible:border-jcyan/70 focus-visible:ring-jcyan/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="jaal-label">Scam category</Label>
                    <Select
                      value={category}
                      onValueChange={(v) => setCategory(v as ScamCategory)}
                    >
                      <SelectTrigger className="border-jborder/70 bg-jsurface text-jtext focus:ring-jcyan/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-jborder/80 bg-popover text-jtext">
                        {SCAM_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="desc" className="jaal-label">
                      Case description
                    </Label>
                    <Textarea
                      id="desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      placeholder="What does this simulation aim to demonstrate?"
                      className="border-jborder/70 bg-jsurface text-jtext placeholder:text-jmuted/50 focus-visible:border-jcyan/70 focus-visible:ring-jcyan/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="notes" className="jaal-label">
                      Internal notes (optional)
                    </Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Analyst-only notes shown in reports"
                      className="border-jborder/70 bg-jsurface text-jtext placeholder:text-jmuted/50 focus-visible:border-jcyan/70 focus-visible:ring-jcyan/40"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-xs text-jmuted">
                    Choose the conversation source.{" "}
                    <span className="text-jamber">
                      Simulation is the primary demo workflow.
                    </span>
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(
                      [
                        {
                          id: "simulation" as const,
                          icon: Radio,
                          title: "Simulated conversation",
                          desc: "Scripted synthetic scammer with contextual branches.",
                          primary: true,
                        },
                        {
                          id: "paste" as const,
                          icon: MessageSquare,
                          title: "Paste transcript",
                          desc: "Paste a sample conversation line by line.",
                        },
                        {
                          id: "import" as const,
                          icon: Upload,
                          title: "Import text file",
                          desc: "Load a supported .txt transcript.",
                        },
                      ]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSource(opt.id)}
                        className={cn(
                          "flex flex-col gap-2 border p-3 text-left transition-colors",
                          source === opt.id
                            ? "border-jcyan/60 bg-jcyan/10"
                            : "border-jborder/70 bg-jsurface hover:border-jcyan/40",
                        )}
                      >
                        <span className="flex items-center justify-between">
                          <opt.icon
                            className={cn(
                              "size-4",
                              source === opt.id ? "text-jcyan" : "text-jmuted",
                            )}
                          />
                          {opt.primary && (
                            <Chip tone="border-jamber/50 bg-jamber/10 text-jamber">
                              recommended
                            </Chip>
                          )}
                        </span>
                        <span className="text-xs font-semibold text-jtext">
                          {opt.title}
                        </span>
                        <span className="text-[11px] leading-snug text-jmuted">
                          {opt.desc}
                        </span>
                      </button>
                    ))}
                  </div>

                  {source === "simulation" && (
                    <div className="flex gap-2 border border-jcyan/30 bg-jcyan/5 p-3">
                      <Sparkles className="mt-0.5 size-4 shrink-0 text-jcyan" />
                      <p className="text-[11px] leading-relaxed text-jmuted">
                        The scammer side runs on a local scripted engine with
                        branching replies (official website, payment reasons,
                        department, case reference, UPI details). No LLM or
                        external service is contacted, and no real scammer is
                        ever messaged.
                      </p>
                    </div>
                  )}

                  {source !== "simulation" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="transcript" className="jaal-label">
                          {source === "import" ? "Transcript file" : "Transcript"}
                        </Label>
                        {source === "import" && (
                          <>
                            <input
                              ref={fileRef}
                              type="file"
                              accept=".txt,.text,text/plain"
                              className="hidden"
                              onChange={(e) => handleFile(e.target.files?.[0])}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => fileRef.current?.click()}
                              className="h-7 cursor-pointer gap-1.5 border-jborder/70 text-jmuted hover:text-jcyan"
                            >
                              <Upload className="size-3.5" /> Choose file
                            </Button>
                          </>
                        )}
                      </div>
                      <Textarea
                        id="transcript"
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        rows={7}
                        placeholder={"Scammer: Your parcel is flagged…\nMe: Who is this?\nScammer: Inspector, Cyber Crime Division…"}
                        className="border-jborder/70 bg-jsurface font-mono text-xs text-jtext placeholder:text-jmuted/40 focus-visible:border-jcyan/70 focus-visible:ring-jcyan/40"
                      />
                      <p className="font-mono text-[10px] uppercase tracking-widest text-jmuted/60">
                        One message per line · “Name: message” format
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="jaal-label">Detection mode</Label>
                    <Select
                      value={detectionMode}
                      onValueChange={(v) => setDetectionMode(v as DetectionMode)}
                    >
                      <SelectTrigger className="border-jborder/70 bg-jsurface text-jtext focus:ring-jcyan/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-jborder/80 bg-popover text-jtext">
                        <SelectItem value="simulation">
                          Simulation — safe default (recommended)
                        </SelectItem>
                        <SelectItem value="balanced">
                          Balanced — heuristic detection
                        </SelectItem>
                        <SelectItem value="manual">
                          Manual — operator triggers only
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-jmuted">
                      Defaults to the safe simulation configuration — nothing
                      leaves this device.
                    </p>
                  </div>

                  <div className="divide-y divide-jborder/50 border border-jborder/70">
                    {[
                      {
                        checked: tacticDetection,
                        onChange: setTacticDetection,
                        title: "Tactic detection",
                        desc: "Detect authority claims, fear, urgency, payment and isolation patterns.",
                      },
                      {
                        checked: identifierExtraction,
                        onChange: setIdentifierExtraction,
                        title: "Identifier extraction",
                        desc: "Pull UPI IDs, phone numbers, URLs and payment amounts into evidence.",
                      },
                      {
                        checked: integrityHashing,
                        onChange: setIntegrityHashing,
                        title: "Integrity hashing",
                        desc: "Record SHA-256 hashes so content changes can be detected later.",
                      },
                    ].map((row) => (
                      <div
                        key={row.title}
                        className="flex items-start justify-between gap-4 p-3"
                      >
                        <div>
                          <p className="text-xs font-semibold text-jtext">
                            {row.title}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-snug text-jmuted">
                            {row.desc}
                          </p>
                        </div>
                        <Switch
                          checked={row.checked}
                          onCheckedChange={row.onChange}
                          className="data-[state=checked]:bg-jcyan data-[state=checked]:text-background"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 4 */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["Title", title],
                      ["Category", category],
                      ["Source", source === "simulation" ? "Simulated conversation" : source === "paste" ? "Pasted transcript" : "Imported file"],
                      ["Detection mode", detectionMode],
                      ["Tactic detection", tacticDetection ? "enabled" : "disabled"],
                      ["Identifier extraction", identifierExtraction ? "enabled" : "disabled"],
                      ["Integrity hashing", integrityHashing ? "enabled" : "disabled"],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        className="flex items-center justify-between gap-3 border border-jborder/60 bg-jsurface px-3 py-2"
                      >
                        <span className="jaal-label">{k}</span>
                        <span className="truncate font-mono text-[11px] text-jtext">
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 border border-jamber/40 bg-jamber/10 p-3">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-jamber" />
                    <p className="text-[11px] leading-relaxed text-jmuted">
                      Starting creates the case locally and opens the live
                      workspace. All identifiers produced are synthetic demo
                      values, clearly marked as such throughout the locker.
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 flex items-start gap-2 border border-jred/40 bg-jred/10 px-3 py-2">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-jred" />
                  <p className="text-xs text-jred">{error}</p>
                </div>
              )}

              <div className="mt-6 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={back}
                  disabled={step === 1}
                  className="cursor-pointer gap-2 border-jborder/70 text-jmuted hover:text-jtext disabled:opacity-40"
                >
                  <ArrowLeft className="size-4" /> Back
                </Button>
                {step < 4 ? (
                  <Button
                    onClick={next}
                    className="cursor-pointer gap-2 bg-jcyan font-semibold text-background hover:bg-jcyan/85"
                  >
                    Continue <ArrowRight className="size-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={start}
                    className="cursor-pointer gap-2 bg-jgreen font-semibold text-background hover:bg-jgreen/85"
                  >
                    <Cpu className="size-4" /> Start investigation
                  </Button>
                )}
              </div>
            </motion.div>
          ) : (
            /* INIT SEQUENCE */
            <motion.div
              key="init"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-6"
            >
              <div className="mb-5 flex items-center gap-3">
                <FileText className="size-4 text-jcyan" />
                <div>
                  <p className="jaal-label">Case initialisation</p>
                  <p className="text-sm font-semibold text-jtext">{title}</p>
                </div>
              </div>
              <ul className="space-y-2">
                {INIT_SEQUENCE.map((line, i) => (
                  <li
                    key={line}
                    className={cn(
                      "flex items-center gap-2 font-mono text-xs transition-opacity",
                      i <= initIndex ? "opacity-100" : "opacity-30",
                    )}
                  >
                    {i < initIndex ? (
                      <CheckCircle2 className="size-3.5 text-jgreen" />
                    ) : i === initIndex ? (
                      <span className="size-3.5 border border-jcyan jaal-pulse" />
                    ) : (
                      <span className="size-3.5 border border-jborder" />
                    )}
                    <span
                      className={
                        i <= initIndex ? "text-jcyan" : "text-jmuted"
                      }
                    >
                      {line}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 h-1 w-full overflow-hidden bg-jsurface">
                <motion.div
                  className="h-full bg-jcyan"
                  initial={{ width: "0%" }}
                  animate={{ width: `${((initIndex + 1) / INIT_SEQUENCE.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={() => navigate("/investigations")}
        className="mt-4 text-xs text-jmuted transition-colors hover:text-jcyan"
      >
        ← Back to investigations
      </button>
    </div>
  );
}
