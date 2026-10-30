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
const EMAIL_RE_G = new RegExp(EMAIL_RE.source, "gi");
const UPI_RE = /\b[a-z0-9][a-z0-9._-]{2,}@[a-z][a-z0-9]{2,}\b/i;
const UPI_RE_G = new RegExp(UPI_RE.source, "gi");
// Indian mobile: optional +91/0 prefix, must start 6-9, exactly 10 significant
// digits, never embedded inside a longer digit run (lookarounds).
const PHONE_RE = /(?<!\d)(?:(?:\+91|0)[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/;
const PHONE_RE_G = new RegExp(PHONE_RE.source, "g");
// Obfuscation-aware URL detection: hxxp://, http[: ]//, www. prefixes, plus
// bracketed/dotted domains like `portal[dot]example[dot]com`.
const URL_RE =
  /\b(?:(?:https?|hxxps?|ftps?)(?::\/\/|\[:\]\/\/)|www\.)[^\s,;"')\]]+/i;
const URL_RE_G = new RegExp(URL_RE.source, "gi");
const DOT_DOMAIN_RE =
  /\b[a-z0-9][a-z0-9-]{1,}(?:\s*(?:\[|\()\s*dot\s*(?:\]|\))\s*[a-z0-9][a-z0-9.-]*)+/i;
const DOT_DOMAIN_RE_G = new RegExp(DOT_DOMAIN_RE.source, "gi");
const MONEY_RE = /(?:₹|rs\.?\s?|inr\s?)\s?\d[\d,]*(?:\s?\d+)?/i;
const MONEY_RE_G = new RegExp(MONEY_RE.source, "gi");
const REF_RE = /\b[A-Z]{2,}\/[A-Z]{2,}\/\d{4}\/[A-Z]{2,}\/\d{2,}\b/;

export interface EvidenceDraft {
  type: EvidenceType;
  label: string;
  value: string;
  content: string;
  /** Heuristic extraction confidence in [0,1] — a review aid, never a fraud verdict. */
  confidence: number;
  /** Which rule produced this, e.g. RULE_BASED_REGEX:url_obfuscated. */
  method: string;
}

/** A TLD-looking tail after the last dot (basic URL validation). */
function looksLikeUrl(value: string): boolean {
  // Normalize obfuscation markers first: `portal[dot]example[dot]com` →
  // `portal.example.com`, `https[:]//` → `https://`.
  const cleaned = value
    .replace(/[.,;:!?\])]+$/, "")
    .replace(/\s*(?:\[|\()\s*dot\s*(?:\]|\))\s*/gi, ".")
    .replace(/\[:\]/g, ":");
  const host =
    cleaned
      .replace(/^(?:https?|hxxps?|ftps?)(?::\/\/|\[:\]\/\/)/i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0] ?? "";
  if (!host.includes(".")) return false;
  const tld = host.split(".").pop() ?? "";
  return /^[a-z]{2,}$/i.test(tld);
}

/** All regex matches (not just the first) for one pattern. */
function matches(text: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(re)) {
    if (m[0]) out.push(m[0]);
  }
  return out;
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
  confidence: number,
  method: string,
): EvidenceDraft {
  return {
    type,
    label: labelFor(type),
    value,
    content: `${labelFor(type)}: ${value}\nSource message: ${sourceText}`,
    confidence,
    method,
  };
}

/**
 * Extract suspicious identifiers from a single message.
 *
 * Rule-based only (no model calls). Multiple indicators of any type are found
 * per message, every value is validated before it is kept, the ORIGINAL
 * matched text is preserved verbatim, and each draft carries its detection
 * method plus a heuristic confidence so the UI can distinguish a strong
 * pattern from a weak one. Detection assistance only — never a confirmed
 * fraud determination.
 */
export function extractIdentifiers(message: ConversationMessage): EvidenceDraft[] {
  if (message.author !== "scammer") return [];
  const text = message.text;
  const found: EvidenceDraft[] = [];
  const seen = new Set<string>();

  const push = (
    type: EvidenceType,
    value: string | null | undefined,
    confidence: number,
    method: string,
  ) => {
    if (!value) return;
    const clean = value.trim().replace(/[.,;]$/, "");
    if (!clean) return;
    const key = `${type}:${clean.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push(draft(type, clean, text, confidence, method));
  };

  // E-mails first: matched spans are blanked so an address is never
  // double-labeled as a (truncated) UPI handle or a phone number.
  let scan = text;
  for (const email of matches(scan, EMAIL_RE_G)) {
    push("email", email, 0.95, "RULE_BASED_REGEX:email");
    scan = scan.replace(email, " ".repeat(email.length));
  }

  for (const upi of matches(scan, UPI_RE_G)) {
    // A handle whose suffix contains a dot-TLD is an e-mail, not a VPA.
    const suffix = upi.split("@")[1] ?? "";
    if (suffix.includes(".")) continue;
    push("upi", upi, 0.9, "RULE_BASED_REGEX:upi_vpa");
  }

  // URLs (incl. obfuscated forms) are blanked before the phone pass so a
  // digit run inside a link is never reported as a phone number.
  const urlSpans = [
    ...matches(scan, URL_RE_G),
    ...matches(scan, DOT_DOMAIN_RE_G),
  ];
  for (const url of urlSpans) {
    if (!looksLikeUrl(url)) continue;
    const obfuscated =
      /^(?:hxxps?|ftps?):/i.test(url) ||
      /\[(?:dot|:|\.\.)\]/i.test(url) ||
      /\(dot\)/i.test(url);
    push(
      "url",
      url,
      obfuscated ? 0.75 : 0.92,
      obfuscated ? "RULE_BASED_REGEX:url_obfuscated" : "RULE_BASED_REGEX:url",
    );
    scan = scan.replace(url, " ".repeat(url.length));
  }

  for (const phone of matches(scan, PHONE_RE_G)) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10 && digits.length !== 12) continue;
    if (!/^[6-9]/.test(digits.slice(-10))) continue;
    push("phone", phone, 0.85, "RULE_BASED_REGEX:phone_in");
  }

  for (const money of matches(text, MONEY_RE_G)) {
    if (!/\d/.test(money)) continue;
    push("payment_request", money, 0.85, "RULE_BASED_REGEX:amount");
  }

  push("other", text.match(REF_RE)?.[0], 0.8, "RULE_BASED_REGEX:case_ref");

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
    confidence: 1,
    method: "CAPTURED_TRANSCRIPT:verbatim",
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
    detectionMethod: d.method,
    confidence: d.confidence,
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
