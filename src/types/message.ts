export type MessageAuthor = "scammer" | "decoy" | "system";

export interface ConversationMessage {
  id: string;
  caseId: string;
  author: MessageAuthor;
  text: string;
  /** Epoch ms */
  timestamp: number;
  /** Where the message came from: SIM-ENGINE, OPERATOR, TRANSCRIPT-IMPORT */
  source: string;
  /** Optional status chip shown on decoy messages (e.g. DECOY-ACTIVE) */
  status?: string;
}

export type TypingTarget = "scammer" | "decoy" | null;
