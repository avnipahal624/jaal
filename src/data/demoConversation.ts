import type { KillChainStageId, TacticId } from "@/types/investigation";

/**
 * SYNTHETIC DEMO SCRIPT — JAAL-001 Digital Arrest Scam.
 *
 * Every identifier below is fabricated for this demonstration. No real people,
 * phone numbers, UPI IDs, URLs or scammer contact details are used, and the
 * simulation never contacts anyone.
 */

export interface ScriptTurn {
  /** Scammer line */
  text: string;
  /** Kill-chain stage this line pushes the conversation into (if any) */
  stage?: KillChainStageId;
  /** Tactics declared by this turn (also cross-checked by keyword detection) */
  tactics: TacticId[];
  /** Evidence to extract from this line (value is verified against the text) */
  identifiers: {
    type: "upi" | "phone" | "url" | "payment_request" | "other";
    value: string;
  }[];
}

/** The scammer's scripted arc. One turn is released per decoy reply. */
export const SCAMMER_ARC: ScriptTurn[] = [
  {
    text: "Good morning. This is the India Post parcel tracking desk. A parcel registered under your Aadhaar number contains contraband material. Your identity has been flagged. Stay on this chat until we complete verification.",
    tactics: [],
    identifiers: [],
  },
  {
    text: "This is Inspector Anand Kumar, Cyber Crime Division, Economic Offences Wing. My badge ID is DEL-4492 and this interaction is being recorded for the case file. Do not disconnect.",
    stage: "authority",
    tactics: ["authority_impersonation"],
    identifiers: [],
  },
  {
    text: "An FIR has already been registered against your Aadhaar. If you do not cooperate in the next few minutes, we will issue a non-bailable warrant and freeze every bank account linked to your PAN.",
    stage: "fear",
    tactics: ["fear_threat", "urgency"],
    identifiers: [],
  },
  {
    text: "To clear your name, a refundable KYC verification amount of ₹25,000 must be deposited today. Once verification clears, the amount is reversed to your account within 30 minutes via RTGS.",
    stage: "payment",
    tactics: ["payment_request", "urgency"],
    identifiers: [
      { type: "payment_request", value: "₹25,000 KYC verification payment" },
    ],
  },
  {
    text: "Open any UPI app and pay to the government verification handle: cyber.verify@jaaldemo. Do not tell anyone — this line is under oath and disclosure will cancel your protection under the interim order.",
    tactics: ["payment_request", "isolation"],
    identifiers: [{ type: "upi", value: "cyber.verify@jaaldemo" }],
  },
  {
    text: "Confirm from this alternate desk line if the portal does not load: +91 98765 43210. Our verification desk portal is here: https://secure-kyc-verification.example/pay — complete it before the deadline expires.",
    tactics: ["urgency"],
    identifiers: [
      { type: "phone", value: "+91 98765 43210" },
      { type: "url", value: "https://secure-kyc-verification.example/pay" },
    ],
  },
  {
    text: "Upload the payment confirmation screenshot immediately. My supervisor is waiting for the clearance file — you have 10 minutes before the arrest order is dispatched from the control room.",
    stage: "exploit",
    tactics: ["fear_threat", "urgency"],
    identifiers: [],
  },
  {
    text: "The file is still open on my desk. Screenshot of the transaction, now. This is the final instruction you will receive on this channel.",
    tactics: ["fear_threat", "urgency"],
    identifiers: [],
  },
];

/** Opening line seeded into the workspace before the operator replies. */
export const OPENING_TURN = SCAMMER_ARC[0]!;

export interface BranchReply {
  id: string;
  /** Keywords matched against the operator's message (lowercased) */
  match: string[];
  /** Alternating scammer replies, cycled per branch activation */
  replies: string[];
  tactics: TacticId[];
  identifiers: ScriptTurn["identifiers"];
  stage?: KillChainStageId;
}

/** Contextual branches — the scammer reacts to what the decoy asks. */
export const BRANCHES: BranchReply[] = [
  {
    id: "official_website",
    match: [
      "website",
      "official",
      "portal",
      "link",
      "domain",
      "verify online",
      "check site",
    ],
    replies: [
      "The verification portal is not public. It is accessible only to verified officials. Share your Aadhaar last four digits here and I will pull your file manually.",
      "There is no public website for this procedure. Sending unverified links is an offence. I will open the case file from my terminal — give me your full name as it appears on PAN.",
    ],
    tactics: ["authority_impersonation", "isolation"],
    identifiers: [],
    stage: "authority",
  },
  {
    id: "why_payment",
    match: [
      "why",
      "payment",
      "pay",
      "money",
      "refund",
      "charge",
      "fee",
      "25000",
      "₹",
    ],
    replies: [
      "The amount is a refundable deposit, not a payment. It proves your funds are not proceeds of crime. The RBI circular on KYC reversal mandates the 30-minute RTGS window.",
      "Every suspect must deposit ₹25,000 as a good-faith verification amount. If your KYC is clean it is reversed the same day. Refusal is recorded as non-cooperation in the FIR.",
    ],
    tactics: ["payment_request", "authority_impersonation"],
    identifiers: [
      { type: "payment_request", value: "₹25,000 KYC verification payment" },
    ],
    stage: "payment",
  },
  {
    id: "department",
    match: [
      "department",
      "office",
      "which police",
      "station",
      "team",
      "inspector",
      "who are you",
      "rank",
      "division",
    ],
    replies: [
      "Economic Offences Wing, Cyber Crime Division, Delhi. Unit 7, badge DEL-4492. You may call the desk on +91 98765 43210 and ask for Inspector Anand Kumar — the case is live there.",
      "I report to the Joint Director of the Cyber Crime unit. My credentials are DEL-4492. The verification desk line is +91 98765 43210 if you want the control room to confirm.",
    ],
    tactics: ["authority_impersonation"],
    identifiers: [{ type: "phone", value: "+91 98765 43210" }],
    stage: "authority",
  },
  {
    id: "case_reference",
    match: [
      "case number",
      "case id",
      "fir",
      "reference",
      "file number",
      "complaint no",
      "acknowledgement",
    ],
    replies: [
      "Your reference is FIR/EOW/2026/DEL/4492. Quote it to the control room. It is already in the system — delaying only adds counts to the charge sheet.",
      "Case reference FIR/EOW/2026/DEL/4492, opened this morning. Verify it on the desk line +91 98765 43210 if you must, then complete the deposit.",
    ],
    tactics: ["authority_impersonation", "urgency"],
    identifiers: [
      { type: "other", value: "FIR/EOW/2026/DEL/4492" },
      { type: "phone", value: "+91 98765 43210" },
    ],
  },
  {
    id: "upi_details",
    match: [
      "upi",
      "upi id",
      "handle",
      "where do i pay",
      "account",
      "bank id",
      "vpa",
    ],
    replies: [
      "Pay to cyber.verify@jaaldemo — the government verification handle. Enter the remark 'KYC CLEARANCE' so the control room can match it to your file.",
      "The VPA is cyber.verify@jaaldemo. Twenty-five thousand, remark 'KYC CLEARANCE'. Send the screenshot the moment it debits.",
    ],
    tactics: ["payment_request"],
    identifiers: [{ type: "upi", value: "cyber.verify@jaaldemo" }],
    stage: "payment",
  },
  {
    id: "delay_or_refuse",
    match: [
      "later",
      "tomorrow",
      "cannot",
      "can't",
      "no money",
      "refuse",
      "not paying",
      "won't",
      "will not",
      "think",
      "ask someone",
    ],
    replies: [
      "There is no 'later' in a non-bailable matter. The control room closes the verification window at 17:00 and the warrant is pushed automatically.",
      "Hesitation is already logged against your file. Complete the deposit now or the next call comes from the arrest team, not from me.",
    ],
    tactics: ["fear_threat", "urgency"],
    identifiers: [],
    stage: "fear",
  },
];

/** Generic fallback when no branch matches. */
export const FALLBACK_REPLIES = [
  "Noted. Continue with the verification steps I gave you — the file cannot stay open indefinitely.",
  "Understood. Reply with the confirmation once the deposit is done so I can close the clearance.",
  "Please proceed. The control room is watching this channel for your confirmation.",
];
