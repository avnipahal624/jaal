import type {
  CaseRunStatus,
  Investigation,
} from "@/types/investigation";
import type { ConversationMessage } from "@/types/message";

/**
 * Synthetic demo data only. Every case, message, identifier and timestamp
 * below is fabricated for the JAAL simulation — none of it describes a real
 * investigation or real people.
 */

export interface SeedCase {
  investigation: Investigation;
  messages: ConversationMessage[];
  /** Script cursor — seeded cases are already exhausted */
  cursor: number;
  turnCount: number;
  status: CaseRunStatus;
  startedAt: number;
  endedAt: number | null;
}

const MIN = 60_000;

function msg(
  caseId: string,
  author: ConversationMessage["author"],
  text: string,
  timestamp: number,
  source = "SIM-ENGINE",
): ConversationMessage {
  return {
    id: `${caseId}-m-${Math.random().toString(36).slice(2, 9)}`,
    caseId,
    author,
    text,
    timestamp,
    source,
    status: author === "decoy" ? "DECOY-ACTIVE" : undefined,
  };
}

export function buildSeedCases(now = Date.now()): SeedCase[] {
  const cases: SeedCase[] = [];

  // ---------------------------------------------------------------- JAAL-001
  // The default demo: only the opening line is seeded. Everything after it is
  // produced live by the simulation engine as the operator interacts.
  const c1Start = now - 6 * MIN;
  cases.push({
    investigation: {
      id: "JAAL-001",
      title: "Digital Arrest Scam — Parcel Flag",
      category: "Digital arrest scam",
      description:
        "Controlled simulation: a caller claims an Aadhaar-linked parcel contains contraband, impersonates the cyber crime unit, threatens arrest and demands a ₹25,000 verification payment.",
      notes: "Synthetic identifiers only. Simulation mode — no live contact.",
      status: "active",
      createdAt: c1Start,
      lastActivityAt: c1Start,
      currentStage: "contact",
      source: "simulation",
      detectionMode: "simulation",
      flags: { tacticDetection: true, identifierExtraction: true, integrityHashing: true },
    },
    messages: [
      msg(
        "JAAL-001",
        "scammer",
        "Good morning. This is the India Post parcel tracking desk. A parcel registered under your Aadhaar number contains contraband material. Your identity has been flagged. Stay on this chat until we complete verification.",
        c1Start,
      ),
    ],
    cursor: 1,
    turnCount: 1,
    status: "running",
    startedAt: c1Start,
    endedAt: null,
  });

  // ---------------------------------------------------------------- JAAL-002
  const c2Start = now - 26 * 60 * MIN;
  const c2End = c2Start + 9 * MIN;
  cases.push({
    investigation: {
      id: "JAAL-002",
      title: "Fake Telecom Refund — KYC Token",
      category: "UPI/payment scam",
      description:
        "Simulated refund scam: a 'Telecom Compliance Unit' demands a ₹1 KYC token to release a fabricated refund, then pressures for a screenshot.",
      notes: "Completed simulation used to demonstrate report generation.",
      status: "completed",
      createdAt: c2Start,
      lastActivityAt: c2End,
      currentStage: "exploit",
      source: "simulation",
      detectionMode: "simulation",
      flags: { tacticDetection: true, identifierExtraction: true, integrityHashing: true },
    },
    messages: [
      msg(
        "JAAL-002",
        "scammer",
        "Your mobile number is linked to a pending refund of ₹7,499 from the telecom authority. Confirm KYC to release the amount today.",
        c2Start,
      ),
      msg(
        "JAAL-002",
        "decoy",
        "Who is this, exactly? Which department?",
        c2Start + MIN,
        "OPERATOR",
      ),
      msg(
        "JAAL-002",
        "scammer",
        "Refund Desk, Telecom Compliance Unit. Your reference is REF/2026/TEL/8871. Verification is mandatory before the window closes.",
        c2Start + 2 * MIN,
      ),
      msg(
        "JAAL-002",
        "scammer",
        "Send the ₹1 KYC token to refunds.desk@jaaldemo from your registered UPI and reply with 'KYC DONE'. Do not discuss this with anyone — the file is confidential.",
        c2Start + 4 * MIN,
      ),
      msg(
        "JAAL-002",
        "decoy",
        "Why would I pay anything to receive a refund?",
        c2Start + 6 * MIN,
        "OPERATOR",
      ),
      msg(
        "JAAL-002",
        "scammer",
        "The token proves account ownership. Without it the refund is reversed to the treasury within 24 hours. Confirm immediately with the screenshot.",
        c2End - MIN,
      ),
      msg(
        "JAAL-002",
        "decoy",
        "End of simulation — closing the session.",
        c2End,
        "OPERATOR",
      ),
    ],
    cursor: 0,
    turnCount: 6,
    status: "completed",
    startedAt: c2Start,
    endedAt: c2End,
  });

  // ---------------------------------------------------------------- JAAL-003
  const c3Start = now - 3 * 24 * 60 * MIN;
  const c3End = c3Start + 5 * MIN;
  cases.push({
    investigation: {
      id: "JAAL-003",
      title: "Bank KYC Expiry Phishing Link",
      category: "Phishing",
      description:
        "Simulated phishing transcript: an 'account review' message pushes a lookalike KYC portal that requests login credentials and an OTP.",
      notes: "Synthetic URL uses the reserved .example domain.",
      status: "completed",
      createdAt: c3Start,
      lastActivityAt: c3End,
      currentStage: "exploit",
      source: "paste",
      detectionMode: "balanced",
      flags: { tacticDetection: true, identifierExtraction: true, integrityHashing: true },
    },
    messages: [
      msg(
        "JAAL-003",
        "scammer",
        "Bank account review: your KYC has expired. Update it within 2 hours or your account will be frozen under RBI guidelines.",
        c3Start,
        "TRANSCRIPT-IMPORT",
      ),
      msg(
        "JAAL-003",
        "decoy",
        "Where do I update it? Send the official link.",
        c3Start + MIN,
        "OPERATOR",
      ),
      msg(
        "JAAL-003",
        "scammer",
        "Use the secure desk portal: https://kyc-review-desk.example/update — enter your internet banking user ID and the OTP you receive. Do not share it with anyone else.",
        c3Start + 2 * MIN,
        "TRANSCRIPT-IMPORT",
      ),
      msg(
        "JAAL-003",
        "scammer",
        "Hurry, the review counter closes at 6 PM. Reply with the confirmation screenshot.",
        c3End,
        "TRANSCRIPT-IMPORT",
      ),
    ],
    cursor: 0,
    turnCount: 3,
    status: "completed",
    startedAt: c3Start,
    endedAt: c3End,
  });

  // ---------------------------------------------------------------- JAAL-004
  const c4Start = now - 9 * 24 * 60 * MIN;
  const c4End = c4Start + 12 * MIN;
  cases.push({
    investigation: {
      id: "JAAL-004",
      title: "Remote Desk Job Onboarding Fee",
      category: "Job scam",
      description:
        "Simulated job scam: an unverified recruiter demands a one-time onboarding deposit and asks the candidate to install a remote support tool for 'form filling'.",
      notes: "Archived after simulation completed.",
      status: "archived",
      createdAt: c4Start,
      lastActivityAt: c4End,
      currentStage: "exploit",
      source: "import",
      detectionMode: "balanced",
      flags: { tacticDetection: true, identifierExtraction: true, integrityHashing: true },
    },
    messages: [
      msg(
        "JAAL-004",
        "scammer",
        "Congratulations — your profile is shortlisted for the remote data-entry desk. A one-time onboarding deposit of ₹4,500 unlocks the offer letter.",
        c4Start,
        "TRANSCRIPT-IMPORT",
      ),
      msg(
        "JAAL-004",
        "decoy",
        "Why does an job ask for money?",
        c4Start + 3 * MIN,
        "OPERATOR",
      ),
      msg(
        "JAAL-004",
        "scammer",
        "It is refundable and adjusted in the first salary. Also install our desk helper app so I can fill the form on your screen — do not tell anyone, offers are confidential.",
        c4Start + 7 * MIN,
        "TRANSCRIPT-IMPORT",
      ),
      msg(
        "JAAL-004",
        "scammer",
        "Send the deposit to onboarding.desk@jaaldemo before 5 PM or the slot is reassigned.",
        c4End,
        "TRANSCRIPT-IMPORT",
      ),
    ],
    cursor: 0,
    turnCount: 3,
    status: "completed",
    startedAt: c4Start,
    endedAt: c4End,
  });

  return cases;
}
