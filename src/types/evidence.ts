export type EvidenceType =
  | "upi"
  | "phone"
  | "url"
  | "payment_request"
  | "scam_message"
  | "transcript"
  | "other";

/**
 * Hash lifecycle only — a hash proves the content has not changed since it was
 * recorded. It does not prove the identifier is genuine or that any person
 * committed a crime.
 */
export type HashStatus =
  | "none" // evidence collected, no hash yet
  | "generated" // hash recorded
  | "verified" // recomputed hash matches recorded hash
  | "mismatch"; // recomputed hash differs from recorded hash

export interface EvidenceItem {
  id: string;
  caseId: string;
  type: EvidenceType;
  /** Short human label, e.g. "UPI ID" */
  label: string;
  /** The extracted value itself */
  value: string;
  /** Canonical content that gets hashed (value + source context) */
  content: string;
  sourceMessageId: string | null;
  sourceMessageText: string;
  /** Epoch ms */
  extractedAt: number;
  /** Unverified lead until a hash is generated and checked */
  notes: string;
  hash: string | null;
  hashGeneratedAt: number | null;
  hashStatus: HashStatus;
  /** Set when the analyst edited content on purpose to demo a mismatch */
  tampered?: boolean;
}

export type EvidenceFilter =
  | "all"
  | "upi"
  | "phone"
  | "url"
  | "message"
  | "transcript"
  | "payment"
  | "verified"
  | "unverified";
