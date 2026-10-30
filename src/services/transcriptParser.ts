/**
 * Shared transcript parser (frontend preview + backend import).
 *
 * Supported formats (a single pass accepts any mix of them):
 *   Name: message
 *   [12:34:56] Name: message
 *   [12:34] Name: message
 *   12:34:56 Name: message
 *   12/05/2024, 10:30 - Name: message          (WhatsApp export)
 *   12/05/2024 10:30 Name: message
 *
 * Guarantees:
 *   - Line order is preserved; nothing is silently dropped.
 *   - Continuation lines (no sender header) attach to the previous message,
 *     so multiline messages survive intact.
 *   - A line that cannot be parsed and has no previous message to attach to
 *     is preserved verbatim and flagged `needsReview`.
 *   - Blank lines are counted, not treated as content.
 *   - Timestamps are captured when present; otherwise left null so the
 *     importer can assign ordered synthetic stamps.
 */

export type ParsedSender = "scammer" | "decoy" | "system";

export interface ParsedTranscriptMessage {
  sender: ParsedSender;
  /** Original sender label as written in the transcript, when present. */
  name: string | null;
  text: string;
  /** Epoch ms when the line carried a timestamp; null otherwise. */
  timestamp: number | null;
  /** 1-based line number where this message starts. */
  line: number;
  /** Original text of the header line (without continuation lines). */
  raw: string;
  /** Preserved verbatim but requires manual review (unparsed header). */
  needsReview: boolean;
}

export interface TranscriptImportStats {
  totalLines: number;
  blankLines: number;
  /** Header lines parsed into messages. */
  parsedMessages: number;
  /** Continuation lines appended to the previous message. */
  continuationLines: number;
  /** Lines preserved verbatim and flagged for manual review. */
  unparsedLines: number;
  /** Messages imported (parsed + preserved review entries). */
  messagesImported: number;
  warnings: string[];
}

export interface ParsedTranscript {
  messages: ParsedTranscriptMessage[];
  stats: TranscriptImportStats;
}

/** Names that identify the operator side of the conversation. */
const DECOY_NAMES =
  /^(me|i|you|myself|decoy|self|operator|user|jaal|analyst|investigator|target|victim)$/i;

/** Sender header: `Name:` where the name is short and does not include a colon. */
const HEADER_RE = /^([A-Za-z][A-Za-z0-9 _.'\-]{0,23}):\s*(.*)$/;

/** Leading `[HH:MM(:SS)]` timestamp. */
const BRACKET_TIME_RE = /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.*)$/;

/** Leading `HH:MM:SS` / `HH:MM` (space separated, no bracket). */
const BARE_TIME_RE = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.*)$/;

/** WhatsApp-style `DD/MM/YYYY, HH:MM - ` or `MM/DD/YYYY HH:MM ` prefix. */
const DATE_TIME_RE =
  /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})[T ,]+(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:-|,)?\s*(.*)$/;

/** A line that *looks like* a failed header attempt (worth flagging). */
const HEADERISH_RE = /^(\[?\d{1,2}:\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/;

function isDecoyName(name: string): boolean {
  return DECOY_NAMES.test(name.trim().toLowerCase());
}

/** Build an epoch ms for a time-only stamp, clamped to within the last 24h. */
function timeOnlyEpoch(hh: number, mm: number, ss: number): number {
  const d = new Date();
  d.setHours(hh, mm, ss, 0);
  if (d.getTime() > Date.now() + 60_000) d.setDate(d.getDate() - 1);
  return d.getTime();
}

/**
 * Parse a date stamp. Day-first vs month-first is disambiguated when either
 * component exceeds 12; ambiguous dates default to day-first (international
 * convention).
 */
function dateTimeEpoch(
  a: number,
  b: number,
  y: number,
  hh: number,
  mm: number,
  ss: number,
): number | null {
  let day: number;
  let month: number;
  if (a > 12 && b <= 12) {
    day = a;
    month = b;
  } else if (b > 12 && a <= 12) {
    day = b;
    month = a;
  } else {
    day = a;
    month = b;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const year = y < 100 ? 2000 + y : y;
  const d = new Date(year, month - 1, day, hh, mm, ss, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}

/**
 * Parse a raw transcript into ordered messages + statistics.
 * Never throws; an empty input yields an empty result with a warning.
 */
export function parseTranscript(raw: string): ParsedTranscript {
  const warnings: string[] = [];
  const messages: ParsedTranscriptMessage[] = [];

  if (!raw || !raw.trim()) {
    return {
      messages,
      stats: {
        totalLines: 0,
        blankLines: 0,
        parsedMessages: 0,
        continuationLines: 0,
        unparsedLines: 0,
        messagesImported: 0,
        warnings: ["Transcript was empty — nothing to import."],
      },
    };
  }

  const lines = raw.split(/\r?\n/);
  let blankLines = 0;
  let parsedMessages = 0;
  let continuationLines = 0;
  let unparsedLines = 0;

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      blankLines += 1;
      return;
    }
    const lineNo = idx + 1;

    // ---- Timestamp prefixes ------------------------------------------------
    let rest = line;
    let timestamp: number | null = null;

    const dm = rest.match(DATE_TIME_RE);
    if (dm) {
      const timeParts = dm[4]!.split(":").map(Number);
      timestamp = dateTimeEpoch(
        Number(dm[1]),
        Number(dm[2]),
        Number(dm[3]),
        timeParts[0]!,
        timeParts[1]!,
        timeParts[2] ?? 0,
      );
      rest = dm[5] ?? "";
    } else {
      const bt = rest.match(BRACKET_TIME_RE);
      if (bt) {
        const parts = bt[1]!.split(":").map(Number);
        timestamp = timeOnlyEpoch(parts[0]!, parts[1]!, parts[2] ?? 0);
        rest = bt[2]!;
      } else {
        const bare = rest.match(BARE_TIME_RE);
        if (bare) {
          const parts = bare[1]!.split(":").map(Number);
          timestamp = timeOnlyEpoch(parts[0]!, parts[1]!, parts[2] ?? 0);
          rest = bare[2]!;
        }
      }
    }

    // ---- Sender header -----------------------------------------------------
    const header = rest.match(HEADER_RE);
    if (header && header[1]) {
      const name = header[1].trim();
      const text = (header[2] ?? "").trim();
      messages.push({
        sender: isDecoyName(name) ? "decoy" : "scammer",
        name,
        text,
        timestamp,
        line: lineNo,
        raw: line,
        needsReview: false,
      });
      parsedMessages += 1;
      return;
    }

    // ---- Continuation of the previous message (multiline support) ----------
    const previous = messages[messages.length - 1];
    if (previous && !previous.needsReview && timestamp === null) {
      previous.text = `${previous.text}\n${line}`;
      continuationLines += 1;
      return;
    }

    // ---- Unparsable — preserved verbatim, flagged for manual review --------
    unparsedLines += 1;
    if (HEADERISH_RE.test(line)) {
      warnings.push(
        `Line ${lineNo}: timestamped line without a recognizable sender — preserved for review.`,
      );
    }
    messages.push({
      sender: "system",
      name: null,
      text: line,
      timestamp,
      line: lineNo,
      raw: line,
      needsReview: true,
    });
  });

  if (parsedMessages === 0 && unparsedLines > 0) {
    warnings.push(
      `No sender headers recognized — ${unparsedLines} line(s) preserved for manual review.`,
    );
  }
  if (messages.length > 1 && messages.every((m) => m.timestamp === null)) {
    warnings.push(
      "No timestamps found in the transcript — messages imported in line order with synthetic times.",
    );
  }

  return {
    messages,
    stats: {
      totalLines: lines.length,
      blankLines,
      parsedMessages,
      continuationLines,
      unparsedLines,
      messagesImported: messages.length,
      warnings,
    },
  };
}

/** One-line human summary of an import (used in logs and notifications). */
export function summarizeImport(stats: TranscriptImportStats): string {
  return [
    `${stats.parsedMessages} message(s) parsed`,
    `${stats.continuationLines} continuation line(s)`,
    `${stats.unparsedLines} line(s) need review`,
    `${stats.blankLines} blank line(s)`,
  ].join(" · ");
}
