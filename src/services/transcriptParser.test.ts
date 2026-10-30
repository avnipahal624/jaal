import { describe, expect, it } from "vitest";
import { parseTranscript, summarizeImport } from "./transcriptParser";

/**
 * Shared transcript parser tests — every supported format, ordering,
 * multiline preservation, honest statistics (never a false full-success) and
 * verbatim retention of unparsed lines. All content is synthetic.
 */

describe("parseTranscript formats", () => {
  it("parses plain `Name: message` lines and preserves order", () => {
    const r = parseTranscript(
      ["Scammer: First line", "Me: Second line", "Scammer: Third line"].join("\n"),
    );
    expect(r.messages).toHaveLength(3);
    expect(r.messages.map((m) => m.sender)).toEqual(["scammer", "decoy", "scammer"]);
    expect(r.messages.map((m) => m.text)).toEqual([
      "First line",
      "Second line",
      "Third line",
    ]);
    expect(r.messages.map((m) => m.line)).toEqual([1, 2, 3]);
    expect(r.stats.unparsedLines).toBe(0);
  });

  it("parses bracketed and bare clock timestamps", () => {
    const r = parseTranscript(
      [
        "[12:34:56] Scammer: bracketed stamp",
        "09:01 Me: bare stamp",
      ].join("\n"),
    );
    expect(r.messages).toHaveLength(2);
    for (const m of r.messages) expect(m.timestamp).toBeTypeOf("number");
    expect(r.messages[0]!.text).toBe("bracketed stamp");
    expect(r.messages[1]!.text).toBe("bare stamp");
  });

  it("parses WhatsApp-style date/time prefixes", () => {
    const r = parseTranscript(
      "12/05/2024, 10:30 - Scammer: WhatsApp export line",
    );
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0]!.sender).toBe("scammer");
    expect(r.messages[0]!.text).toBe("WhatsApp export line");
    expect(r.messages[0]!.timestamp).toBeTypeOf("number");
  });

  it("attaches continuation lines so multiline messages survive intact", () => {
    const r = parseTranscript(
      [
        "Scammer: line one",
        "continues without a sender",
        "and another continuation",
        "Me: next speaker",
      ].join("\n"),
    );
    expect(r.messages).toHaveLength(2);
    expect(r.messages[0]!.text).toBe(
      "line one\ncontinues without a sender\nand another continuation",
    );
    expect(r.messages[1]!.text).toBe("next speaker");
    expect(r.stats.continuationLines).toBe(2);
  });

  it("classifies operator-side names as decoy", () => {
    const r = parseTranscript(["Me: question", "Operator: reply"].join("\n"));
    expect(r.messages.map((m) => m.sender)).toEqual(["decoy", "decoy"]);
  });
});

describe("parseTranscript honesty", () => {
  it("preserves an unparsable first line verbatim, flags it, and counts it", () => {
    const r = parseTranscript(
      ["!!! no sender header here", "Scammer: valid line"].join("\n"),
    );
    expect(r.messages).toHaveLength(2);
    const flagged = r.messages[0]!;
    expect(flagged.needsReview).toBe(true);
    expect(flagged.raw).toBe("!!! no sender header here");
    expect(r.stats.unparsedLines).toBe(1);
    expect(r.stats.parsedMessages).toBe(1);
    expect(r.stats.messagesImported).toBe(2);
    // Statistics never claim full success when a line needed review.
    expect(r.stats.unparsedLines).toBeGreaterThan(0);
  });

  it("counts blank lines separately from content", () => {
    const r = parseTranscript("Scammer: hi\n\n\nMe: yo\n");
    // Trailing newline yields a final empty entry — counted, not hidden.
    expect(r.stats.totalLines).toBe(5);
    expect(r.stats.blankLines).toBe(3);
    expect(r.messages).toHaveLength(2);
  });

  it("returns an empty result with a warning for empty input", () => {
    const r = parseTranscript("   \n  ");
    expect(r.messages).toHaveLength(0);
    expect(r.stats.warnings.length).toBeGreaterThan(0);
  });

  it("summarizeImport never reports success while lines were skipped", () => {
    const r = parseTranscript("garbage line\nScammer: ok");
    const summary = summarizeImport(r.stats);
    expect(summary).toMatch(/1/);
    expect(summary).toMatch(/review|unparsed|skip|need/i);
  });
});
