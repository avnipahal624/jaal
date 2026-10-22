import type {
  DetectedTactic,
  KillChainStage,
  KillChainStageId,
  LogLevel,
  LogEntry,
  TacticId,
  TacticMeta,
} from "@/types/investigation";
import type { ConversationMessage } from "@/types/message";
import type { EvidenceDraft } from "./evidenceService";
import { extractIdentifiers } from "./evidenceService";

/**
 * Content-derived tactic and kill-chain detection.
 *
 * Every detection below is triggered by the actual text of a message in this
 * session — stages never advance arbitrarily, and no external intelligence
 * database is consulted.
 */

export const TACTIC_META: Record<TacticId, TacticMeta> = {
  authority_impersonation: {
    id: "authority_impersonation",
    name: "Authority impersonation",
    description: "Caller claims law-enforcement, regulatory or government standing.",
  },
  fear_threat: {
    id: "fear_threat",
    name: "Fear and threat",
    description: "Uses arrest, account freeze or legal consequences as leverage.",
  },
  urgency: {
    id: "urgency",
    name: "Urgency",
    description: "Forces a deadline to prevent the target from verifying claims.",
  },
  payment_request: {
    id: "payment_request",
    name: "Payment request",
    description: "Requests money, deposits or a UPI transfer.",
  },
  isolation: {
    id: "isolation",
    name: "Isolation",
    description: "Discourages the target from telling anyone else.",
  },
  remote_access: {
    id: "remote_access",
    name: "Remote access request",
    description: "Requests screen sharing, remote tools or device access.",
  },
};

interface Pattern {
  re: RegExp;
  explain: string;
}

const TACTIC_PATTERNS: Record<TacticId, Pattern[]> = {
  authority_impersonation: [
    {
      re: /police|inspector|cyber ?crime|cyber ?cell|government|govt\.|authority|authorities|cbi|fbi|rbi|court|judge|badge|fir\b|charge sheet|india post|telecom compliance|economic offences|department|officer|control room|joint director/i,
      explain: "Message asserts law-enforcement or government standing",
    },
  ],
  fear_threat: [
    {
      re: /arrest|warrant|jail|freeze|frozen|block(?:ed|ing)? (?:your|every|all)|non-bailable|contraband|raid|prosecut|penalt|suspend|charge sheet|seize/i,
      explain: "Message threatens arrest, seizure or account restrictions",
    },
  ],
  urgency: [
    {
      re: /immediat|urgent|minutes?\b|deadline|hurry|last warning|final instruction|within \d+|expires?|closing|window closes?|today\b|asap|time is running|the next few|before \d/i,
      explain: "Message applies a time pressure or countdown",
    },
  ],
  payment_request: [
    {
      re: /₹|rs\.?\s?\d|inr\s?\d|\bpay\b|payment|deposit|upi|vpa|transfer|refundable|kyc (?:token|verification amount)|onboarding deposit/i,
      explain: "Message requests money movement or a UPI transfer",
    },
  ],
  isolation: [
    {
      re: /do not tell|don't tell|do not discuss|do not share|keep this between|confidential|not tell anyone|do not disclose|stay on this chat|do not disconnect|under oath|offers are confidential/i,
      explain: "Message discourages involving anyone else",
    },
  ],
  remote_access: [
    {
      re: /screen share|share (?:your )?screen|anydesk|teamviewer|remote (?:access|support|desktop)|install (?:the|our|this)|desk helper|\.apk\b|control (?:your|the) device/i,
      explain: "Message requests device access or remote tooling",
    },
  ],
};

export interface TacticHit {
  tactic: TacticId;
  explanation: string;
}

/** Detect tactics declared by the text of one scammer message. */
export function detectTactics(message: ConversationMessage): TacticHit[] {
  if (message.author !== "scammer") return [];
  const hits: TacticHit[] = [];
  for (const [id, patterns] of Object.entries(TACTIC_PATTERNS) as [
    TacticId,
    Pattern[],
  ][]) {
    for (const p of patterns) {
      const match = message.text.match(p.re);
      if (match) {
        hits.push({
          tactic: id,
          explanation: `${TACTIC_META[id].name}: ${p.explain} (matched “${match[0]}”)`,
        });
        break;
      }
    }
  }
  return hits;
}

interface StagePattern {
  re: RegExp;
  reason: string;
  label: string;
}

const STAGE_PATTERNS: Record<KillChainStageId, StagePattern> = {
  contact: {
    re: /./,
    reason: "First inbound message opened the channel",
    label: "Initial contact",
  },
  authority: {
    re: /police|inspector|cyber ?crime|cyber ?cell|government|govt\.|authority|cbi|rbi|badge|fir\b|department|officer|economic offences|india post|telecom compliance|control room/i,
    reason: "Message claims institutional or law-enforcement authority",
    label: "Authority claim",
  },
  fear: {
    re: /arrest|warrant|jail|freeze|frozen|non-bailable|contraband|charge sheet|block(?:ed)? (?:your|every)|raid|seize/i,
    reason: "Message threatens legal or financial consequences",
    label: "Fear tactic",
  },
  payment: {
    re: /₹|rs\.?\s?\d|inr\s?\d|\bpay\b|payment|deposit|upi|vpa|transfer to/i,
    reason: "Message demands money or a transfer",
    label: "Payment request",
  },
  exploit: {
    re: /screenshot|otp\b|password|credentials|internet banking|screen share|share (?:your )?screen|anydesk|teamviewer|install (?:the|our|this)|desk helper|user id/i,
    reason: "Message demands confirmation artefacts, credentials or device access",
    label: "Remote access / exploitation",
  },
};

export const STAGE_ORDER: KillChainStageId[] = [
  "contact",
  "authority",
  "fear",
  "payment",
  "exploit",
];

export const STAGE_LABELS: Record<KillChainStageId, string> = {
  contact: "Initial contact",
  authority: "Authority claim",
  fear: "Fear tactic",
  payment: "Payment request",
  exploit: "Remote access / exploitation",
};

export const STAGE_DESCRIPTIONS: Record<KillChainStageId, string> = {
  contact: "Unsolicited inbound message opens the channel.",
  authority: "Caller impersonates police, regulator or government office.",
  fear: "Arrest, freeze or legal threat used as leverage.",
  payment: "Money, deposit or UPI transfer demanded.",
  exploit:
    "Escalation: remote access request, credential capture or proof-of-payment harvesting.",
};

export function createStages(): KillChainStage[] {
  return STAGE_ORDER.map((id, i) => ({
    id,
    number: i + 1,
    label: STAGE_LABELS[id],
    description: STAGE_DESCRIPTIONS[id],
    status: "pending" as const,
    detectedAt: null,
    messageIds: [],
    tactics: [],
    reason: "",
  }));
}

export interface StageHit {
  stage: KillChainStageId;
  reason: string;
}

/** Which kill-chain stage(s) this message's content evidences. */
export function detectStage(message: ConversationMessage): StageHit | null {
  if (message.author !== "scammer") return null;
  for (const id of STAGE_ORDER) {
    if (id === "contact") continue;
    const sp = STAGE_PATTERNS[id];
    if (sp.re.test(message.text)) return { stage: id, reason: sp.reason };
  }
  // Any inbound scammer message evidences initial contact.
  return { stage: "contact", reason: STAGE_PATTERNS.contact.reason };
}

/** Detect the contact stage explicitly for the very first scammer message. */
export function isContactStage(message: ConversationMessage): boolean {
  return message.author === "scammer";
}

/**
 * Merge a newly detected stage into the chain: the newest detected stage
 * becomes active, previous active stages complete, undetected stay pending.
 */
export function advanceStage(
  stages: KillChainStage[],
  hit: StageHit,
  message: ConversationMessage,
  tacticIds: TacticId[],
): KillChainStage[] {
  const index = STAGE_ORDER.indexOf(hit.stage);
  return stages.map((stage) => {
    const stageIndex = STAGE_ORDER.indexOf(stage.id);
    if (stageIndex > index && stage.status !== "pending") {
      // keep later detections intact
      return stage;
    }
    if (stage.id === hit.stage) {
      return {
        ...stage,
        status: stage.detectedAt ? stage.status : "detected",
        detectedAt: stage.detectedAt ?? message.timestamp,
        messageIds: stage.messageIds.includes(message.id)
          ? stage.messageIds
          : [...stage.messageIds, message.id],
        tactics: Array.from(new Set([...stage.tactics, ...tacticIds])),
        reason: stage.reason || hit.reason,
      };
    }
    if (stageIndex < index && stage.status !== "pending") {
      return { ...stage, status: "completed" as const };
    }
    return stage;
  });
}

/** Normalize statuses: highest detected = active, earlier = completed. */
export function normalizeStages(stages: KillChainStage[]): KillChainStage[] {
  let highest = -1;
  stages.forEach((s, i) => {
    if (s.status !== "pending" && i > highest) highest = i;
  });
  if (highest < 0) return stages;
  return stages.map((s, i) => {
    if (s.status === "pending") return s;
    if (i === highest) return { ...s, status: "active" as const };
    return { ...s, status: "completed" as const };
  });
}

export function currentStageId(stages: KillChainStage[]): KillChainStageId {
  let current: KillChainStageId = "contact";
  for (const s of stages) if (s.status !== "pending") current = s.id;
  return current;
}

export interface AnalysisResult {
  tactics: Omit<DetectedTactic, "id">[];
  evidence: EvidenceDraft[];
  stages: KillChainStage[];
  logs: Omit<LogEntry, "id">[];
  /** Already de-duplicated against existing tactic keys */
  newTacticCount: number;
  stageChanged: boolean;
}

export interface AnalysisOptions {
  tacticDetection: boolean;
  identifierExtraction: boolean;
  /** Override detection time (used when materialising seeded history) */
  at?: number;
}

/**
 * Run the full analysis pipeline for one incoming message:
 * detect tactics → extract identifiers → update kill-chain → emit logs.
 */
export function analyzeMessage(
  message: ConversationMessage,
  existingTactics: DetectedTactic[],
  stages: KillChainStage[],
  options: AnalysisOptions,
): { tactics: DetectedTactic[]; evidence: EvidenceDraft[]; stages: KillChainStage[]; logs: LogEntry[] } {
  const now = options.at ?? Date.now();
  const uid = () => Math.random().toString(36).slice(2, 9);
  const newTactics: DetectedTactic[] = [];
  const logs: LogEntry[] = [];
  const log = (level: LogLevel, text: string) =>
    logs.push({ id: `log-${uid()}`, caseId: message.caseId, timestamp: now, level, message: text });

  const addLog = (level: LogLevel, text: string) => log(level, text);

  let nextStages = stages;

  if (message.author === "scammer") {
    addLog("info", `Message received from ${message.source}`);

    // 1. Tactic detection
    if (options.tacticDetection) {
      const hits = detectTactics(message);
      for (const hit of hits) {
        const key = `${hit.tactic}:${message.id}`;
        const already = existingTactics.some((t) => t.id === key) ||
          newTactics.some((t) => t.id === key);
        if (already) continue;
        newTactics.push({
          id: key,
          caseId: message.caseId,
          tactic: hit.tactic,
          messageId: message.id,
          sourceText: message.text,
          timestamp: now,
          explanation: hit.explanation,
        });
        addLog("warn", `Tactic detected: ${TACTIC_META[hit.tactic].name}`);
      }
    }

    // 2. Kill-chain progression (content-derived)
    const stageHit = detectStage(message);
    if (stageHit) {
      const before = stages.find((s) => s.id === stageHit.stage);
      const tacticIds = newTactics.map((t) => t.tactic);
      let working = stages;
      // The first inbound message of a session also evidences initial contact,
      // even when its content already matches a stronger stage.
      if (working.every((s) => s.status === "pending")) {
        working = advanceStage(
          working,
          { stage: "contact", reason: STAGE_PATTERNS.contact.reason },
          message,
          tacticIds,
        );
      }
      nextStages = normalizeStages(
        advanceStage(working, stageHit, message, tacticIds),
      );
      if (!before || before.status === "pending") {
        addLog(
          "info",
          `Investigation stage updated: ${STAGE_LABELS[stageHit.stage]}`,
        );
      }
    }

    // 3. Identifier extraction
    if (options.identifierExtraction) {
      const drafts = extractIdentifiers(message);
      drafts.forEach((d) => {
        addLog("info", `Identifier extracted: ${d.label} ${d.value}`);
      });
      return {
        tactics: newTactics,
        evidence: drafts,
        stages: nextStages,
        logs,
      };
    }
    return { tactics: newTactics, evidence: [], stages: nextStages, logs };
  }

  return { tactics: [], evidence: [], stages: nextStages, logs };
}
