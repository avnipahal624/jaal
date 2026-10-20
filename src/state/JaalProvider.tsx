import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { clearDemoSession, setDemoSession } from "@/lib/demoSession";
import { api, probeBackend, tryApi, type BackendStatus } from "@/services/api";
import {
  generateEvidenceHash,
  verifyEvidenceIntegrity,
  transcriptEvidence,
} from "@/services/evidenceService";
import { buildReport } from "@/services/reportService";
import { arcExhausted, nextScammerTurn } from "@/services/simulationService";
import type { Investigation, ScamCategory, DetectionMode } from "@/types/investigation";
import type { ConversationMessage } from "@/types/message";
import type { EvidenceReport } from "@/types/report";
import {
  loadState,
  reducer,
  saveState,
  clearPersistedState,
  uid,
  type AppNotification,
  type JaalState,
  type SettingsPatch,
} from "./reducer";

export interface CreateCaseInput {
  title: string;
  category: ScamCategory;
  description: string;
  notes: string;
  source: Investigation["source"];
  detectionMode: DetectionMode;
  flags: Investigation["flags"];
  /** Raw text when the source is a paste or import */
  transcript?: string;
}

interface JaalContextValue {
  state: JaalState;
  // auth / session
  signInDemo: (name: string, email: string) => void;
  signOutDemo: () => void;
  updateProfile: (name: string) => void;
  setBackendStatus: (status: BackendStatus) => void;
  // cases
  createCase: (input: CreateCaseInput) => string;
  getCase: (caseId: string) => { investigation: Investigation; runtime: JaalState["sessions"][string] } | null;
  sendMessage: (caseId: string, text: string) => Promise<void>;
  /** Trigger the next scripted scammer line without operator input. */
  advanceSimulation: (caseId: string) => Promise<void>;
  /** Import pasted transcript lines directly into the conversation. */
  ingestTranscript: (caseId: string, raw: string) => number;
  togglePause: (caseId: string) => void;
  endInvestigation: (caseId: string) => void;
  resetCase: (caseId: string) => void;
  resetDemoData: () => void;
  clearLogs: (caseId: string) => void;
  setCaseStatus: (caseId: string, status: Investigation["status"]) => void;
  // evidence
  generateHash: (caseId: string, evidenceId: string) => Promise<void>;
  verifyEvidence: (caseId: string, evidenceId: string) => Promise<"match" | "mismatch" | "error">;
  setEvidenceContent: (caseId: string, evidenceId: string, content: string) => void;
  setEvidenceNotes: (caseId: string, evidenceId: string, notes: string) => void;
  // reports
  createReport: (caseId: string) => EvidenceReport | null;
  // settings / notifications
  updateSettings: (patch: SettingsPatch) => void;
  notify: (n: Omit<AppNotification, "id" | "read" | "timestamp">) => void;
  markNotificationsRead: () => void;
  clearNotifications: () => void;
}

const JaalContext = createContext<JaalContextValue | null>(null);

const REPLY_DELAY_MIN = 1100;
const REPLY_DELAY_MAX = 2100;

export function JaalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, loadState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const processedHashes = useRef<Set<string>>(new Set());
  const saveTimer = useRef<number | null>(null);

  // Hydrate demo session + persisted state on first mount.
  useEffect(() => {
    dispatch({ type: "HYDRATE", state: loadState() });
  }, []);

  // Backend probe (falls back to local simulation when unavailable).
  useEffect(() => {
    let cancelled = false;
    probeBackend().then((status) => {
      if (!cancelled) dispatch({ type: "SET_BACKEND_STATUS", status });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist state (debounced).
  useEffect(() => {
    if (!state.hydrated) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveState(state), 350);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [state]);

  // Auto-generate SHA-256 hashes for evidence that has none yet.
  useEffect(() => {
    if (!state.settings.investigation.autoHash) return;
    const pending: { caseId: string; evidenceId: string }[] = [];
    for (const [caseId, rt] of Object.entries(state.sessions)) {
      const inv = state.investigations.find((i) => i.id === caseId);
      if (!inv?.flags.integrityHashing) continue;
      for (const e of rt.evidence) {
        if (!e.hash && !processedHashes.current.has(e.id)) {
          pending.push({ caseId, evidenceId: e.id });
        }
      }
    }
    if (pending.length === 0) return;
    pending.forEach((p) => processedHashes.current.add(p.evidenceId));
    pending.forEach(async (p) => {
      const item = stateRef.current.sessions[p.caseId]?.evidence.find(
        (e) => e.id === p.evidenceId,
      );
      if (!item) return;
      try {
        const { hash, at } = await generateEvidenceHash(item);
        dispatch({ type: "HASH_SET", caseId: p.caseId, evidenceId: p.evidenceId, hash, at });
      } catch {
        /* Web Crypto unavailable */
      }
    });
  }, [state.sessions, state.investigations, state.settings.investigation.autoHash]);

  const signInDemo = useCallback((name: string, email: string) => {
    const session = setDemoSession(name, email);
    dispatch({ type: "SET_USER", user: session });
  }, []);

  const signOutDemo = useCallback(() => {
    clearDemoSession();
    dispatch({ type: "SET_USER", user: null });
  }, []);

  const updateProfile = useCallback((name: string) => {
    const current = stateRef.current.user;
    const trimmed = name.trim() || "Simulation Operator";
    const session = setDemoSession(trimmed, current?.email ?? "operator@jaal.demo");
    dispatch({ type: "SET_USER", user: session });
  }, []);

  const setBackendStatus = useCallback((status: BackendStatus) => {
    dispatch({ type: "SET_BACKEND_STATUS", status });
  }, []);

  const createCase = useCallback((input: CreateCaseInput): string => {
    const now = Date.now();
    const nextNumber =
      stateRef.current.investigations.reduce((max, inv) => {
        const n = Number(inv.id.split("-")[1]);
        return Number.isFinite(n) && n > max ? n : max;
      }, 0) + 1;
    const caseId = `JAAL-${String(nextNumber).padStart(3, "0")}`;
    const investigation: Investigation = {
      id: caseId,
      title: input.title,
      category: input.category,
      description: input.description,
      notes: input.notes,
      status: "active",
      createdAt: now,
      lastActivityAt: now,
      currentStage: "contact",
      source: input.source,
      detectionMode: input.detectionMode,
      flags: input.flags,
    };

    // Paste / import sources seed the transcript directly.
    let seedMessages: ConversationMessage[] = [];
    let transcriptDraft: ReturnType<typeof transcriptEvidence> | null = null;
    if (input.transcript && input.transcript.trim()) {
      const rawLines = input.transcript.split(/\r?\n/).filter((l) => l.trim());
      let stamp = 0;
      const parsed: ConversationMessage[] = [];
      for (const line of rawLines) {
        const m = line.match(
          /^(?:\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*)?([A-Za-z][A-Za-z ]{1,20}):\s*(.+)$/,
        );
        if (!m) continue;
        const who = m[1]!.toLowerCase().trim();
        const isDecoy = /^(me|you|decoy|self|operator|user|jaal)$/.test(who);
        parsed.push({
          id: uid("msg"),
          caseId,
          author: isDecoy ? "decoy" : "scammer",
          text: m[2]!,
          timestamp: now + stamp * 1500,
          source: input.source === "paste" ? "OPERATOR" : "TRANSCRIPT-IMPORT",
          status: isDecoy ? "DECOY-ACTIVE" : undefined,
        });
        stamp += 1;
      }
      seedMessages = parsed;
      if (parsed.length > 0) transcriptDraft = transcriptEvidence(caseId, parsed);
    }

    dispatch({ type: "CREATE_CASE", investigation, seedMessages, transcriptDraft });

    return caseId;
  }, []);

  const getCase = useCallback((caseId: string) => {
    const investigation = stateRef.current.investigations.find((i) => i.id === caseId);
    const runtime = stateRef.current.sessions[caseId];
    if (!investigation || !runtime) return null;
    return { investigation, runtime };
  }, []);

  const sendMessage = useCallback(async (caseId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const snapshot = stateRef.current;
    const rt = snapshot.sessions[caseId];
    const inv = snapshot.investigations.find((i) => i.id === caseId);
    if (!rt || !inv) return;
    if (rt.status === "completed" || rt.status === "paused") return;

    const now = Date.now();
    const userMessage: ConversationMessage = {
      id: uid("msg"),
      caseId,
      author: "decoy",
      text: trimmed,
      timestamp: now,
      source: "OPERATOR",
      status: "DECOY-ACTIVE",
    };
    dispatch({ type: "INGEST_MESSAGE", message: userMessage });

    // Backend conversation endpoint when available, otherwise local engine.
    const remote = await tryApi(() =>
      api.sendMessage({ sessionId: caseId, author: "decoy", text: trimmed }),
    );
    if (remote) {
      dispatch({ type: "INGEST_MESSAGE", message: { ...remote, caseId } });
      return;
    }

    dispatch({ type: "TYPING", caseId, typing: true });
    const delay =
      REPLY_DELAY_MIN + Math.random() * (REPLY_DELAY_MAX - REPLY_DELAY_MIN);
    await new Promise((resolve) => setTimeout(resolve, delay));

    const current = stateRef.current.sessions[caseId];
    if (!current || current.status !== "running") {
      dispatch({ type: "TYPING", caseId, typing: false });
      return;
    }

    const turn = nextScammerTurn(trimmed, current.cursor, current.turnCount);
    if (turn.exhausted) {
      dispatch({ type: "TYPING", caseId, typing: false });
      dispatch({
        type: "INGEST_MESSAGE",
        message: {
          id: uid("msg"),
          caseId,
          author: "system",
          text: "Channel quiet — scripted simulation exhausted. Investigation marked complete.",
          timestamp: Date.now(),
          source: "SIM-ENGINE",
        },
      });
      dispatch({ type: "SET_CASE_STATUS", caseId, status: "completed" });
      return;
    }

    const reply: ConversationMessage = {
      id: uid("msg"),
      caseId,
      author: "scammer",
      text: turn.text,
      timestamp: Date.now(),
      source: turn.branch ? `SIM-ENGINE·${turn.branch.id}` : "SIM-ENGINE",
    };
    const nextCursor = turn.arc ? current.cursor + 1 : current.cursor;
    const nextTurnCount = current.turnCount + 1;
    if (arcExhausted(nextCursor) && !turn.branch) {
      // Last arc line: mark completion right after it lands.
      dispatch({
        type: "INGEST_MESSAGE",
        message: reply,
        cursor: nextCursor,
        turnCount: nextTurnCount,
      });
      dispatch({ type: "SET_CASE_STATUS", caseId, status: "completed" });
      return;
    }
    dispatch({
      type: "INGEST_MESSAGE",
      message: reply,
      cursor: nextCursor,
      turnCount: nextTurnCount,
    });
  }, []);

  const advanceSimulation = useCallback(async (caseId: string) => {
    const current = stateRef.current.sessions[caseId];
    if (!current || current.status !== "running") return;

    if (arcExhausted(current.cursor)) {
      dispatch({
        type: "INGEST_MESSAGE",
        message: {
          id: uid("msg"),
          caseId,
          author: "system",
          text: "Script exhausted — no further synthetic lines available.",
          timestamp: Date.now(),
          source: "SIM-ENGINE",
        },
      });
      return;
    }

    dispatch({ type: "TYPING", caseId, typing: true });
    await new Promise((r) => setTimeout(r, 700));
    const rt = stateRef.current.sessions[caseId];
    if (!rt || rt.status !== "running") {
      dispatch({ type: "TYPING", caseId, typing: false });
      return;
    }
    const turn = nextScammerTurn("", rt.cursor, rt.turnCount);
    if (turn.exhausted) {
      dispatch({ type: "TYPING", caseId, typing: false });
      dispatch({ type: "SET_CASE_STATUS", caseId, status: "completed" });
      return;
    }
    const nextCursor = turn.arc ? rt.cursor + 1 : rt.cursor;
    dispatch({
      type: "INGEST_MESSAGE",
      message: {
        id: uid("msg"),
        caseId,
        author: "scammer",
        text: turn.text,
        timestamp: Date.now(),
        source: turn.branch ? `SIM-ENGINE·${turn.branch.id}` : "SIM-ENGINE",
      },
      cursor: nextCursor,
      turnCount: rt.turnCount + 1,
    });
    if (arcExhausted(nextCursor) && !turn.branch) {
      dispatch({ type: "SET_CASE_STATUS", caseId, status: "completed" });
    }
  }, []);

  const ingestTranscript = useCallback((caseId: string, raw: string): number => {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let count = 0;
    let offset = 0;
    for (const line of lines) {
      const m = line.match(
        /^(?:\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*)?([A-Za-z][A-Za-z ]{1,20}):\s*(.+)$/,
      );
      if (!m) continue;
      const who = m[1]!.toLowerCase().trim();
      const isDecoy = /^(me|you|decoy|self|operator|user|jaal)$/.test(who);
      dispatch({
        type: "INGEST_MESSAGE",
        message: {
          id: uid("msg"),
          caseId,
          author: isDecoy ? "decoy" : "scammer",
          text: m[2]!,
          timestamp: Date.now() + offset,
          source: "TRANSCRIPT-IMPORT",
          status: isDecoy ? "DECOY-ACTIVE" : undefined,
        },
      });
      offset += 400;
      count += 1;
    }
    return count;
  }, []);

  const togglePause = useCallback((caseId: string) => {
    const rt = stateRef.current.sessions[caseId];
    if (!rt || rt.status === "completed") return;
    dispatch({
      type: "SET_CASE_STATUS",
      caseId,
      status: rt.status === "running" ? "paused" : "running",
    });
  }, []);

  const endInvestigation = useCallback((caseId: string) => {
    dispatch({ type: "SET_CASE_STATUS", caseId, status: "completed" });
  }, []);

  const resetCase = useCallback((caseId: string) => {
    processedHashes.current.clear();
    dispatch({ type: "RESET_CASE", caseId });
  }, []);

  const resetDemoData = useCallback(() => {
    processedHashes.current.clear();
    clearPersistedState();
    dispatch({ type: "RESET_DEMO" });
  }, []);

  const clearLogs = useCallback((caseId: string) => {
    dispatch({ type: "CLEAR_LOGS", caseId });
  }, []);

  const setCaseStatus = useCallback(
    (caseId: string, status: Investigation["status"]) => {
      dispatch({ type: "SET_CASE_FILTER_STATUS", caseId, status });
    },
    [],
  );

  const generateHash = useCallback(async (caseId: string, evidenceId: string) => {
    const item = stateRef.current.sessions[caseId]?.evidence.find((e) => e.id === evidenceId);
    if (!item) return;
    try {
      const { hash, at } = await generateEvidenceHash(item);
      dispatch({ type: "HASH_SET", caseId, evidenceId, hash, at });
    } catch {
      dispatch({
        type: "NOTIFY",
        notification: {
          title: "Hashing unavailable",
          detail: "Web Crypto API requires a secure context.",
          caseId,
          kind: "system",
        },
      });
    }
  }, []);

  const verifyEvidence = useCallback(
    async (caseId: string, evidenceId: string): Promise<"match" | "mismatch" | "error"> => {
      const item = stateRef.current.sessions[caseId]?.evidence.find((e) => e.id === evidenceId);
      if (!item) return "error";
      if (!item.hash) {
        // No recorded hash yet — generate first, then report generated state.
        await generateHash(caseId, evidenceId);
        return "error";
      }
      try {
        const result = await verifyEvidenceIntegrity(item);
        dispatch({
          type: "VERIFY_RESULT",
          caseId,
          evidenceId,
          match: result.match,
          at: Date.now(),
        });
        // Also inform the backend when it is reachable.
        void tryApi(() =>
          api.verifyEvidence(caseId, { evidenceId, content: item.content }),
        );
        return result.match ? "match" : "mismatch";
      } catch {
        return "error";
      }
    },
    [generateHash],
  );

  const setEvidenceContent = useCallback(
    (caseId: string, evidenceId: string, content: string) => {
      dispatch({ type: "SET_EVIDENCE_CONTENT", caseId, evidenceId, content });
    },
    [],
  );

  const setEvidenceNotes = useCallback(
    (caseId: string, evidenceId: string, notes: string) => {
      dispatch({ type: "SET_EVIDENCE_NOTES", caseId, evidenceId, notes });
    },
    [],
  );

  const createReport = useCallback((caseId: string): EvidenceReport | null => {
    const snapshot = stateRef.current;
    const inv = snapshot.investigations.find((i) => i.id === caseId);
    const rt = snapshot.sessions[caseId];
    if (!inv || !rt) return null;
    const report = buildReport(
      inv,
      rt,
      snapshot.user?.name ?? "Simulation operator",
    );
    dispatch({ type: "REPORT_CREATED", report });
    return report;
  }, []);

  const updateSettings = useCallback((patch: SettingsPatch) => {
    dispatch({ type: "UPDATE_SETTINGS", patch });
  }, []);

  const notify = useCallback((n: Omit<AppNotification, "id" | "read" | "timestamp">) => {
    dispatch({ type: "NOTIFY", notification: n });
  }, []);

  const markNotificationsRead = useCallback(() => {
    dispatch({ type: "MARK_NOTIFS_READ" });
  }, []);

  const clearNotifications = useCallback(() => {
    dispatch({ type: "CLEAR_NOTIFS" });
  }, []);

  const value = useMemo<JaalContextValue>(
    () => ({
      state,
      signInDemo,
      signOutDemo,
      setBackendStatus,
      createCase,
      getCase,
      sendMessage,
      advanceSimulation,
      ingestTranscript,
      togglePause,
      endInvestigation,
      resetCase,
      resetDemoData,
      clearLogs,
      setCaseStatus,
      generateHash,
      verifyEvidence,
      setEvidenceContent,
      setEvidenceNotes,
      createReport,
      updateSettings,
      notify,
      markNotificationsRead,
      clearNotifications,
      updateProfile,
    }),
    [
      state,
      signInDemo,
      signOutDemo,
      setBackendStatus,
      createCase,
      getCase,
      sendMessage,
      advanceSimulation,
      ingestTranscript,
      togglePause,
      endInvestigation,
      resetCase,
      resetDemoData,
      clearLogs,
      setCaseStatus,
      generateHash,
      verifyEvidence,
      setEvidenceContent,
      setEvidenceNotes,
      createReport,
      updateSettings,
      notify,
      markNotificationsRead,
      clearNotifications,
      updateProfile,
    ],
  );

  return <JaalContext.Provider value={value}>{children}</JaalContext.Provider>;
}

export function useJaal(): JaalContextValue {
  const ctx = useContext(JaalContext);
  if (!ctx) throw new Error("useJaal must be used within JaalProvider");
  return ctx;
}

/** Convenience for the seeded/derived state without the actions. */
export function useJaalState(): JaalState {
  return useJaal().state;
}
