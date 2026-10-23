import type { EvidenceItem, EvidenceType } from "@/types/evidence";
import type { ConversationMessage } from "@/types/message";
import { sha256Hex } from "@/utils/hash";

/**
 * Identifier extraction over locally available evidence text.
 * Patterns match synthetic demo content — nothing here queries external
 * databases or traces real accounts.
 */

/**
 * Handle-shaped identifiers. A domain with a dot-TLD after the @ is an email
 * address; a bare alphanumeric suffix (per NPCI VPA rules the bank handle
 * carries no dot) is a UPI ID. Emails are classified first so an address like
 * support@paypal.com is never mislabeled as a UPI handle.
 */
const EMAIL_RE = /\b[a-z0-9][a-z0-9._-]*@[a-z0-9][a-z0-9.-]*\.[a-z]{2,}\b/i;
const UPI_RE = /\b[a-z0-9][a-z0-9._-]{2,}@[a-z][a-z0-9]{2,}\b/i;
const PHONE_RE = /(?:\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/;
const URL_RE = /\bhttps?:\/\/[^\s,;"')\]]+/i;
const MONEY_RE = /(?:₹|rs\.?\s?|inr\s?)\s?\d[\d,]*(?:\s?\d+)?/i;
const REF_RE = /\b[A-Z]{2,}\/[A-Z]{2,}\/\d{4}\/[A-Z]{2,}\/\d{2,}\b/;

export interface EvidenceDraft {
  type: EvidenceType;
  label: string;
  value: string;
  content: string;
}

function labelFor(type: EvidenceType): string {
  switch (type) {
    case "upi":
      return "UPI ID";
    case "phone":
      return "Phone number";
    case "url":
      return "Suspicious URL";
    case "email":
      return "Email address";
    case "payment_request":
      return "Payment request";
    case "scam_message":
      return "Scam message";
    case "transcript":
      return "Transcript";
    default:
      return "Other identifier";
  }
}

function draft(
  type: EvidenceType,
  value: string,
  sourceText: string,
): EvidenceDraft {
  return {
    type,
    label: labelFor(type),
    value,
    content: `${labelFor(type)}: ${value}\nSource message: ${sourceText}`,
  };
}

/** Extract suspicious identifiers from a single message. */
export function extractIdentifiers(message: ConversationMessage): EvidenceDraft[] {
  if (message.author !== "scammer") return [];
  const text = message.text;
  const found: EvidenceDraft[] = [];
  const seen = new Set<string>();

  const push = (type: EvidenceType, value: string | null | undefined) => {
    if (!value) return;
    const clean = value.trim().replace(/[.,;]$/, "");
    const key = `${type}:${clean.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push(draft(type, clean, text));
  };

  // Email first: a dot-TLD domain wins over the VPA-shaped pattern, and the
  // matched span is removed from the scan text so an address is never
  // double-labeled as a (truncated) UPI handle.
  const emailMatch = text.match(EMAIL_RE);
  if (emailMatch) push("email", emailMatch[0]);
  const upiScanText = emailMatch ? text.replace(EMAIL_RE, " ") : text;
  push("upi", upiScanText.match(UPI_RE)?.[0]);
  push("phone", text.match(PHONE_RE)?.[0]);
  push("url", text.match(URL_RE)?.[0]);
  push("payment_request", text.match(MONEY_RE)?.[0]);
  push("other", text.match(REF_RE)?.[0]);

  return found;
}

/** Build transcript evidence for an imported/pasted conversation. */
export function transcriptEvidence(
  caseId: string,
  messages: ConversationMessage[],
): EvidenceDraft {
  const content = messages
    .map(
      (m) =>
        `[${new Date(m.timestamp).toISOString()}] ${m.author.toUpperCase()}: ${m.text}`,
    )
    .join("\n");
  return {
    type: "transcript",
    label: "Transcript",
    value: `${messages.length}-message synthetic transcript`,
    content: `Transcript (${caseId}):\n${content}`,
  };
}

export function toEvidenceItem(
  caseId: string,
  d: EvidenceDraft,
  source: { messageId: string | null; messageText: string },
  now = Date.now(),
): EvidenceItem {
  return {
    id: `ev-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    caseId,
    type: d.type,
    label: d.label,
    value: d.value,
    content: d.content,
    sourceMessageId: source.messageId,
    sourceMessageText: source.messageText,
    extractedAt: now,
    notes:
      d.type === "transcript"
        ? "Full local transcript captured from the controlled simulation."
        : "Synthetic demo identifier — extracted from simulation content only.",
    hash: null,
    hashGeneratedAt: null,
    hashStatus: "none",
  };
}

/** Generate a SHA-256 hash for stored evidence content (Web Crypto). */
export async function generateEvidenceHash(
  item: EvidenceItem,
): Promise<{ id: string; hash: string; at: number }> {
  const hash = await sha256Hex(item.content);
  return { id: item.id, hash, at: Date.now() };
}

/** Recompute the hash and compare against the recorded hash. */
export async function verifyEvidenceIntegrity(
  item: EvidenceItem,
): Promise<{ id: string; match: boolean; recomputed: string }> {
  if (!item.hash) throw new Error("No recorded hash for this evidence item");
  const recomputed = await sha256Hex(item.content);
  return {
    id: item.id,
    match: recomputed.toLowerCase() === item.hash.toLowerCase(),
    recomputed,
  };
}

export function evidenceMatchesFilter(
  item: EvidenceItem,
  filter: string,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "upi":
      return item.type === "upi" || item.type === "payment_request";
    case "phone":
      return item.type === "phone";
    case "url":
      return item.type === "url" || item.type === "other";
    case "email":
      return item.type === "email";
    case "message":
      return item.type === "scam_message";
    case "transcript":
      return item.type === "transcript";
    case "payment":
      return item.type === "payment_request";
    case "verified":
      return item.hashStatus === "verified";
    case "unverified":
      return item.hashStatus === "none" || item.hashStatus === "generated";
    default:
      return true;
  }
}
