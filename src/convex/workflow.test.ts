import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

/**
 * Backend workflow tests — these exercise the real Convex functions against
 * the mock Convex runtime. All scenario data is synthetic.
 */

const FLAGS = {
  tacticDetection: true,
  identifierExtraction: true,
  integrityHashing: true,
  aiSuggestions: true,
} as const;

function setup() {
  // Most workflow tests model a signed-in user. Tests for anonymous access
  // intentionally construct a raw convexTest instance instead.
  return convexTest(schema, modules).withIdentity({ subject: "test-user" });
}

async function createCase(
  t: ReturnType<typeof setup>,
  caseId = "JAAL-100",
) {
  await t.mutation(api.jaal.createInvestigation, {
    caseId,
    title: "Digital Arrest Scam — Parcel Flag",
    category: "Digital arrest scam",
    description: "Controlled simulation: synthetic parcel + authority scam.",
    notes: "Synthetic identifiers only.",
    source: "simulation",
    detectionMode: "simulation",
    flags: { ...FLAGS },
  });
  return t;
}

describe("investigation management", () => {
  it("creates a case with a seeded opening message, contact stage and running status", async () => {
    const t = setup();
    await createCase(t);
    const state = await t.query(api.jaal.state);
    expect(state.investigations).toHaveLength(1);
    const inv = state.investigations[0]!;
    expect(inv.id).toBe("JAAL-100");
    expect(inv.status).toBe("active");

    const rt = state.sessions["JAAL-100"]!;
    expect(rt.status).toBe("running");
    expect(rt.messages).toHaveLength(1);
    expect(rt.messages[0]!.author).toBe("scammer");
    expect(rt.messages[0]!.text).toMatch(/parcel/i);
    // Opening line must not advance the chain past content it evidences.
    const payment = rt.stages.find((s) => s.id === "payment")!;
    expect(payment.status).toBe("pending");
  });

  it("pauses and resumes the simulation", async () => {
    const t = setup();
    await createCase(t);
    await t.mutation(api.jaal.setRunStatus, {
      caseId: "JAAL-100",
      action: "pause",
    });
    const paused = await t.mutation(api.jaal.sendMessage, {
      caseId: "JAAL-100",
      text: "Hello?",
    });
    expect(paused.reply).toBeNull();

    await t.mutation(api.jaal.setRunStatus, {
      caseId: "JAAL-100",
      action: "resume",
    });
    const resumed = await t.mutation(api.jaal.sendMessage, {
      caseId: "JAAL-100",
      text: "Which department are you from?",
    });
    expect(resumed.reply).toBeTruthy();
  });

  it("archives a case without deleting evidence", async () => {
    const t = setup();
    await createCase(t);
    await t.mutation(api.jaal.sendMessage, {
      caseId: "JAAL-100",
      text: "Why is a payment required?",
    });
    await t.mutation(api.jaal.archiveInvestigation, { caseId: "JAAL-100" });
    const state = await t.query(api.jaal.state);
    expect(state.investigations[0]!.status).toBe("archived");
    expect(state.sessions["JAAL-100"]!.evidence.length).toBeGreaterThan(0);
  });
});

describe("conversation processing", () => {
  it("runs the full pipeline: analyze → extract → hash → kill-chain → strategy", async () => {
    const t = setup();
    await createCase(t);
    const result = await t.mutation(api.jaal.sendMessage, {
      caseId: "JAAL-100",
      text: "Why is a payment required? Which UPI ID should I pay?",
    });
    expect(result.reply).toBeTruthy();

    const state = await t.query(api.jaal.state);
    const rt = state.sessions["JAAL-100"]!;

    // Conversation: seeded opener + decoy + scammer reply.
    expect(rt.messages.map((m) => m.author)).toEqual([
      "scammer",
      "decoy",
      "scammer",
    ]);
    // Original decoy text is preserved verbatim.
    const decoy = rt.messages.find((m) => m.author === "decoy")!;
    expect(decoy.text).toBe(
      "Why is a payment required? Which UPI ID should I pay?",
    );

    // Tactic detection with source text and explanation.
    const tacticIds = rt.tactics.map((x) => x.tactic);
    expect(tacticIds).toContain("authority_impersonation");
    expect(rt.tactics.every((x) => x.sourceText.length > 0)).toBe(true);
    expect(rt.tactics.every((x) => x.explanation.length > 0)).toBe(true);

    // Kill-chain advanced from reply content (the reply cites the FIR →
    // authority claim evidence). Stage detection never runs on timers.
    const detectedStages = rt.stages
      .filter((s) => s.status !== "pending")
      .map((s) => s.id);
    expect(detectedStages).toContain("authority");
    const authority = rt.stages.find((s) => s.id === "authority")!;
    expect(authority.detectedAt).not.toBeNull();

    // Identifier extraction with server-side SHA-256 at extraction time.
    expect(rt.evidence.length).toBeGreaterThan(0);
    const paymentEv = rt.evidence.find((e) => e.type === "payment_request")!;
    expect(paymentEv.value).toMatch(/₹|rs/i);
    expect(paymentEv.hash).toMatch(/^[0-9a-f]{64}$/i);
    expect(paymentEv.hashStatus).toBe("generated");
    expect(paymentEv.sourceMessageText!.length).toBeGreaterThan(0);

    // Activity events + logs power the console.
    expect(rt.activities.length).toBeGreaterThan(0);
    expect(rt.logs.length).toBeGreaterThan(0);

    // Strategy suggestion derived from the conversation (SIMULATION engine).
    expect(rt.strategy?.source).toBe("SIMULATION");
    expect(rt.strategy!.question.length).toBeGreaterThan(10);
  });

  it("returns the next scripted scammer line on simulationNext", async () => {
    const t = setup();
    await createCase(t);
    const before = (await t.query(api.jaal.state)).sessions["JAAL-100"]!;
    const result = await t.mutation(api.jaal.simulationNext, {
      caseId: "JAAL-100",
    });
    expect(result.reply).toBeTruthy();
    const after = (await t.query(api.jaal.state)).sessions["JAAL-100"]!;
    expect(after.messages.length).toBe(before.messages.length + 1);
  });

  it("dedupes repeated identifiers across messages", async () => {
    const t = setup();
    await createCase(t);
    // Both replies from the UPI branch name the same synthetic handle.
    await t.mutation(api.jaal.sendMessage, {
      caseId: "JAAL-100",
      text: "Which UPI handle should the deposit go to?",
    });
    await t.mutation(api.jaal.sendMessage, {
      caseId: "JAAL-100",
      text: "Type the UPI handle again, please.",
    });
    const rt = (await t.query(api.jaal.state)).sessions["JAAL-100"]!;
    const upi = rt.evidence.filter(
      (e) => e.type === "upi" && e.value.toLowerCase() === "cyber.verify@jaaldemo",
    );
    expect(upi).toHaveLength(1);
    // Both source occurrences remain in the conversation record.
    const replies = rt.messages.filter((m) =>
      m.text.includes("cyber.verify@jaaldemo"),
    );
    expect(replies).toHaveLength(2);
  });

  it("enforces a per-case message rate limit", async () => {
    const t = setup();
    await createCase(t);
    // Opening seed counts as one message; each send adds two (decoy+scammer).
    let rejected = false;
    for (let i = 0; i < 12; i += 1) {
      try {
        await t.mutation(api.jaal.sendMessage, {
          caseId: "JAAL-100",
          text: `Question number ${i}?`,
        });
      } catch (e) {
        rejected = String(e).includes("Rate limit");
        break;
      }
    }
    expect(rejected).toBe(true);
  });
});

describe("evidence integrity", () => {
  it("reports baseline hash generation separately from a verification result", async () => {
    const t = setup();
    await t.mutation(api.jaal.updateSettings, {
      investigation: { autoHash: false },
    });
    await createCase(t);
    await t.mutation(api.jaal.sendMessage, {
      caseId: "JAAL-100",
      text: "Deposit ₹25,000 to continue verification.",
    });
    const rt = (await t.query(api.jaal.state)).sessions["JAAL-100"]!;
    const ev = rt.evidence.find((e) => e.type === "payment_request")!;
    expect(ev.hash).toBeNull();

    const outcome = await t.mutation(api.jaal.verifyEvidence, {
      evidenceId: ev.id as never,
    });
    expect(outcome).toBe("generated");
  });

  it("verifies a match, then detects tampering as a mismatch", async () => {
    const t = setup();
    await createCase(t);
    await t.mutation(api.jaal.sendMessage, {
      caseId: "JAAL-100",
      text: "Deposit ₹25,000 to continue verification.",
    });
    const rt = (await t.query(api.jaal.state)).sessions["JAAL-100"]!;
    const ev = rt.evidence.find((e) => e.type === "payment_request")!;

    // Untampered content verifies.
    const match = await t.mutation(api.jaal.verifyEvidence, {
      evidenceId: ev.id as never,
    });
    expect(match).toBe("match");

    // Tamper with the stored snapshot → mismatch.
    await t.mutation(api.jaal.setEvidenceContent, {
      evidenceId: ev.id as never,
      content: "Payment request: ₹99,999\nSource message: altered",
    });
    const mismatch = await t.mutation(api.jaal.verifyEvidence, {
      evidenceId: ev.id as never,
    });
    expect(mismatch).toBe("mismatch");
  });

  it("regenerates a hash on demand and exposes the source message", async () => {
    const t = setup();
    await createCase(t);
    // The department branch reply names the synthetic desk line.
    await t.mutation(api.jaal.sendMessage, {
      caseId: "JAAL-100",
      text: "Which department are you from?",
    });
    const rt = (await t.query(api.jaal.state)).sessions["JAAL-100"]!;
    const phone = rt.evidence.find((e) => e.type === "phone")!;
    expect(phone.hash).toMatch(/^[0-9a-f]{64}$/i);

    const detail = await t.query(api.jaal.getEvidence, {
      evidenceId: phone.id as never,
    });
    expect(detail?.sourceMessage?.text).toContain("+91 98765 43210");
  });

  it("updates analyst notes without altering the evidence snapshot", async () => {
    const t = setup();
    await createCase(t);
    await t.mutation(api.jaal.sendMessage, {
      caseId: "JAAL-100",
      text: "Pay ₹500 via UPI.",
    });
    const rt = (await t.query(api.jaal.state)).sessions["JAAL-100"]!;
    const ev = rt.evidence.find((e) => e.type === "payment_request")!;
    const before = ev.content;
    await t.mutation(api.jaal.setEvidenceNotes, {
      evidenceId: ev.id as never,
      notes: "Analyst: compare with JAAL-002 handle.",
    });
    const verify = await t.mutation(api.jaal.verifyEvidence, {
      evidenceId: ev.id as never,
    });
    expect(verify).toBe("match"); // content untouched → still verifies
    const after = (await t.query(api.jaal.state)).sessions["JAAL-100"]!;
    const updated = after.evidence.find((e) => e.id === ev.id)!;
    expect(updated.content).toBe(before);
    expect(updated.notes).toContain("compare with JAAL-002");
  });
});

describe("completion and reports", () => {
  it("completes the case and generates a structured report from real data", async () => {
    const t = setup();
    await createCase(t);
    await t.mutation(api.jaal.sendMessage, {
      caseId: "JAAL-100",
      text: "Why is a payment required?",
    });
    await t.mutation(api.jaal.completeInvestigation, { caseId: "JAAL-100" });

    const state = await t.query(api.jaal.state);
    expect(state.investigations[0]!.status).toBe("completed");
    expect(state.reports).toHaveLength(1);
    const report = state.reports[0]!;
    expect(report.caseId).toBe("JAAL-100");
    expect(report.simulated).toBe(true);
    expect(report.evidenceCount).toBeGreaterThan(0);
    expect(report.integrity.hashed).toBe(report.evidenceCount);
    expect(report.summary.scenario.length).toBeGreaterThan(20);
    expect(report.transcript.length).toBeGreaterThan(0);
    expect(report.tactics.length).toBeGreaterThan(0);
    expect(report.stages).toHaveLength(5);
    expect(report.timeline.length).toBeGreaterThan(0);
  });
});

describe("settings", () => {
  it("persists settings patches per owner", async () => {
    const t = setup();
    await t.mutation(api.jaal.updateSettings, {
      investigation: { autoHash: false, defaultCategory: "Phishing" },
      appearance: { density: "compact" },
    });
    const state = await t.query(api.jaal.state);
    expect(state.settings.investigation.autoHash).toBe(false);
    expect(state.settings.investigation.defaultCategory).toBe("Phishing");
    expect(state.settings.appearance.density).toBe("compact");
    // Unrelated defaults untouched.
    expect(state.settings.appearance.theme).toBe("dark");
  });
});

describe("demo data", () => {
  it("seeds and resets the synthetic demo cases", async () => {
    const t = setup();
    await t.mutation(api.jaal.seedDemo, {});
    const seeded = await t.query(api.jaal.state);
    expect(seeded.investigations.length).toBeGreaterThanOrEqual(4);
    expect(seeded.investigations.some((i) => i.id === "JAAL-001")).toBe(true);

    // Operator-created cases exist before the reset…
    await createCase(t, "JAAL-100");
    expect((await t.query(api.jaal.state)).investigations).toHaveLength(5);

    // …and resetDemo wipes everything back to the clean seeded demo state.
    await t.mutation(api.jaal.resetDemo, {});
    const cleared = await t.query(api.jaal.state);
    expect(cleared.investigations.some((i) => i.id === "JAAL-100")).toBe(false);
    expect(cleared.investigations.some((i) => i.id === "JAAL-001")).toBe(true);
    expect(
      cleared.reports.some((r) => r.caseId === "JAAL-100"),
    ).toBe(false);
  });
});

describe("authorization", () => {
  it("rejects anonymous backend and AI access instead of using a shared demo owner", async () => {
    const anonymous = convexTest(schema, modules);
    await expect(anonymous.query(api.jaal.state, {})).rejects.toThrow(/authentication required/i);
    await expect(
      anonymous.action(api.ai.strategyAction, {
        transcript: [{ author: "scammer", text: "Synthetic test message" }],
        activeStage: "contact",
      }),
    ).rejects.toThrow(/authentication required/i);
  });

  it("rejects oversized AI strategy input before any provider call", async () => {
    const t = setup();
    await expect(
      t.action(api.ai.strategyAction, {
        transcript: Array.from({ length: 21 }, () => ({
          author: "scammer" as const,
          text: "synthetic transcript line",
        })),
        activeStage: "contact",
      }),
    ).rejects.toThrow(/size limit/i);
  });

  it("hides other owners' cases and rejects cross-owner mutations", async () => {
    const t = setup();
    const alice = t.withIdentity({ subject: "alice" });
    const bob = t.withIdentity({ subject: "bob" });

    await alice.mutation(api.jaal.createInvestigation, {
      caseId: "JAAL-777",
      title: "Alice case",
      category: "Digital arrest scam",
      description: "d",
      notes: "n",
      source: "simulation",
      detectionMode: "simulation",
      flags: { ...FLAGS },
    });

    // Bob sees nothing of Alice's work.
    const bobState = await bob.query(api.jaal.state);
    expect(bobState.investigations).toHaveLength(0);

    // Bob cannot read or mutate Alice's case.
    await expect(
      bob.mutation(api.jaal.sendMessage, {
        caseId: "JAAL-777",
        text: "Hi",
      }),
    ).rejects.toThrow(/not found/);
    await expect(
      bob.mutation(api.jaal.completeInvestigation, { caseId: "JAAL-777" }),
    ).rejects.toThrow(/not found/);

    // Alice retains access.
    const aliceState = await alice.query(api.jaal.state);
    expect(aliceState.investigations).toHaveLength(1);
  });
});

describe("analyst review + report completeness", () => {
  it("persists a review verdict, records one evidence_reviewed event, and reflects the review in the report", async () => {
    const t = setup();
    await createCase(t, "JAAL-300");
    await t.mutation(api.jaal.sendMessage, {
      caseId: "JAAL-300",
      text: "Why is a payment required?",
    });
    const state = await t.query(api.jaal.state);
    const item = state.sessions["JAAL-300"]!.evidence[0]!;
    expect(item).toBeDefined();
    const originalValue = item.value;
    const originalHash = item.hash;

    await t.mutation(api.jaal.reviewEvidence, {
      evidenceId: item.id as never,
      status: "confirmed",
      note: "checked against transcript",
    });

    const after = await t.query(api.jaal.state);
    const reviewed = after.sessions["JAAL-300"]!.evidence.find(
      (e) => e.id === item.id,
    )!;
    // Verdict stored separately — extraction and hash untouched.
    expect(reviewed.reviewStatus).toBe("confirmed");
    expect(reviewed.reviewNote).toBe("checked against transcript");
    expect(reviewed.reviewedAt).toBeGreaterThan(0);
    expect(reviewed.value).toBe(originalValue);
    expect(reviewed.hash).toBe(originalHash);

    // Exactly one activity event for the review (no duplicates).
    const events = after.sessions["JAAL-300"]!.activities.filter(
      (a) => a.kind === "evidence_reviewed",
    );
    expect(events).toHaveLength(1);
    expect(events[0]!.title).toBe("Analyst review recorded");

    // The generated report carries the review on the evidence row.
    const report = await t.mutation(api.jaal.generateReport, {
      caseId: "JAAL-300",
    });
    const row = report.evidence.find((e) => e.id === item.id)!;
    expect(row.review.status).toBe("confirmed");
    expect(row.review.note).toBe("checked against transcript");
    // Hash lifecycle data is present on the row too.
    expect(row.hashStatus).toBe("generated");
    // Source-message traceability for the indicators table.
    expect(row.sourceMessageId).toBeTruthy();
    expect(row.sourceMessageNumber).toBeGreaterThanOrEqual(1);
    // Tactic rows carry their supporting message reference as well.
    const linked = report.tactics.filter((t) => t.messageNumber != null);
    expect(linked.length).toBeGreaterThan(0);
  });

  it("completing an investigation is idempotent — no duplicate reports on repeat calls", async () => {
    const t = setup();
    await createCase(t, "JAAL-301");
    await t.mutation(api.jaal.sendMessage, {
      caseId: "JAAL-301",
      text: "Why is a payment required?",
    });
    await t.mutation(api.jaal.completeInvestigation, { caseId: "JAAL-301" });
    await t.mutation(api.jaal.completeInvestigation, { caseId: "JAAL-301" });
    const state = await t.query(api.jaal.state);
    expect(state.reports.filter((r) => r.caseId === "JAAL-301")).toHaveLength(1);
  });
});
