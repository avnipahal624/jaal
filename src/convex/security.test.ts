import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

/**
 * Security & evidence-integrity tests: unauthenticated rejection, cross-owner
 * isolation, AI rate limiting, and the full evidence lifecycle (generation ≠
 * verification, persistent mismatch, explicit reason-bound re-baseline,
 * tamper-simulation preserving the original snapshot and history).
 * All scenario data is synthetic.
 */

const FLAGS = {
  tacticDetection: true,
  identifierExtraction: true,
  integrityHashing: true,
  aiSuggestions: true,
} as const;

const UNAUTHENTICATED =
  "Not authenticated — an identity is required to access JAAL data.";

function base() {
  return convexTest(schema, modules);
}

type Base = ReturnType<typeof base>;

/**
 * Derive an authenticated identity from a base instance. `withIdentity`
 * shares the same in-memory store, so signed-out and second-owner calls in
 * these tests hit the SAME data (a fresh `convexTest` would be an empty,
 * isolated database).
 */
function as(t: Base, subject: string) {
  return t.withIdentity({ subject });
}

/** Helper instances carry an identity (the authed paths under test). */
type T = ReturnType<typeof as>;

async function createCase(t: T, caseId = "JAAL-500") {
  await t.mutation(api.jaal.createInvestigation, {
    caseId,
    title: "Security audit case",
    category: "Digital arrest scam",
    description: "Synthetic case for auth/integrity tests.",
    notes: "Synthetic identifiers only.",
    source: "simulation",
    detectionMode: "simulation",
    flags: { ...FLAGS },
  });
  return t;
}

async function invId(t: T, caseId: string): Promise<Id<"investigations">> {
  const doc = await t.run(async (ctx) =>
    ctx.db
      .query("investigations")
      .filter((q) => q.eq(q.field("caseId"), caseId))
      .first(),
  );
  if (!doc) throw new Error(`case ${caseId} not found`);
  return (doc as Doc<"investigations">)._id;
}

/** Insert a deterministic evidence row owned by the case's owner. */
async function insertEvidence(t: T, caseId: string): Promise<Id<"evidence">> {
  const investigationId = await invId(t, caseId);
  return t.run(async (ctx) => {
    const inv = (await ctx.db.get(investigationId))!;
    return ctx.db.insert("evidence", {
      investigationId: inv._id,
      owner: inv.owner,
      caseId,
      sourceMessageText: "synthetic source line",
      label: "UPI ID",
      evidenceType: "upi",
      extractedValue: "audit@okhdfc",
      normalizedValue: "audit@okhdfc",
      content: "UPI ID: audit@okhdfc\nSource message: send it now",
      extractionMethod: "RULE_BASED_REGEX:upi_vpa",
      extractionTimestamp: 1_000,
      integrityStatus: "NOT_HASHED",
      notes: "",
      createdAt: 1_000,
    });
  });
}

async function readEvidence(t: T, id: Id<"evidence">) {
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

describe("unauthenticated rejection", () => {
  it("state returns null instead of data when there is no identity", async () => {
    const t = base();
    expect(await t.query(api.jaal.state)).toBeNull();
  });

  it("every write path rejects without an identity", async () => {
    const t = base();
    await expect(
      t.mutation(api.jaal.createInvestigation, {
        caseId: "JAAL-501",
        title: "Nope",
        category: "UPI/payment scam",
        description: "should be rejected",
        source: "simulation",
        detectionMode: "simulation",
        flags: { ...FLAGS },
      }),
    ).rejects.toThrow(UNAUTHENTICATED);
    await expect(
      t.mutation(api.jaal.sendMessage, { caseId: "JAAL-501", text: "hi" }),
    ).rejects.toThrow(UNAUTHENTICATED);
    await expect(
      t.mutation(api.jaal.updateSettings, { appearance: {} }),
    ).rejects.toThrow(UNAUTHENTICATED);
  });

  it("evidence operations reject without an identity", async () => {
    const env = base();
    const owner = as(env, "auth-owner");
    await createCase(owner);
    const evId = await insertEvidence(owner, "JAAL-500");

    // Same store, no identity — the row exists, the caller is anonymous.
    const anon = env;
    await expect(anon.query(api.jaal.getEvidence, { evidenceId: evId })).rejects.toThrow(
      UNAUTHENTICATED,
    );
    await expect(
      anon.mutation(api.jaal.generateHash, { evidenceId: evId }),
    ).rejects.toThrow(UNAUTHENTICATED);
    await expect(
      anon.mutation(api.jaal.verifyEvidence, { evidenceId: evId }),
    ).rejects.toThrow(UNAUTHENTICATED);
    await expect(
      anon.mutation(api.jaal.setEvidenceContent, {
        evidenceId: evId,
        content: "tampered",
      }),
    ).rejects.toThrow(UNAUTHENTICATED);
  });
});

describe("cross-owner isolation", () => {
  it("a second identity can neither read nor mutate another owner's case", async () => {
    const env = base();
    const alice = as(env, "owner-alice");
    await createCase(alice, "JAAL-510");
    const evId = await insertEvidence(alice, "JAAL-510");

    const bob = as(env, "owner-bob");
    // Bob's workspace contains no trace of Alice's case.
    const bobState = await bob.query(api.jaal.state);
    expect(bobState).not.toBeNull();
    expect(bobState!.investigations.map((i) => i.id)).not.toContain("JAAL-510");

    // Case-scoped reads resolve through the owner index → not found for Bob.
    await expect(
      bob.mutation(api.jaal.sendMessage, { caseId: "JAAL-510", text: "hi" }),
    ).rejects.toThrow(/not found/i);

    // Direct evidence access → authorization error.
    await expect(
      bob.query(api.jaal.getEvidence, { evidenceId: evId }),
    ).rejects.toThrow("Not authorized");
    await expect(
      bob.mutation(api.jaal.generateHash, { evidenceId: evId }),
    ).rejects.toThrow("Not authorized");
    await expect(
      bob.mutation(api.jaal.rebaselineEvidence, {
        evidenceId: evId,
        reason: "trying someone else's evidence",
      }),
    ).rejects.toThrow("Not authorized");
    await expect(
      bob.mutation(api.jaal.setEvidenceContent, {
        evidenceId: evId,
        content: "bob was here",
      }),
    ).rejects.toThrow("Not authorized");

    // AI budget is per-owner and scoped to cases the caller owns.
    await expect(
      bob.mutation(api.jaal.recordAiRequest, {
        caseId: "JAAL-510",
        kind: "strategy",
      }),
    ).rejects.toThrow(/not found/i);

    // Alice's data is untouched.
    const after = await readEvidence(alice, evId);
    expect(after.content).toContain("audit@okhdfc");
    expect(after.integrityStatus).toBe("NOT_HASHED");
  });
});

describe("AI request rate limiting", () => {
  it("allows up to the per-owner budget, then rejects within the window", async () => {
    const t = as(base(), "rate-owner");
    await createCase(t, "JAAL-520");
    // Budget is 8 requests / 60s per owner (AI_RATE_MAX / AI_RATE_WINDOW_MS).
    for (let i = 0; i < 8; i++) {
      const res = await t.mutation(api.jaal.recordAiRequest, {
        caseId: "JAAL-520",
        kind: "strategy",
      });
      expect(res.allowed).toBe(true);
    }
    await expect(
      t.mutation(api.jaal.recordAiRequest, {
        caseId: "JAAL-520",
        kind: "summary",
      }),
    ).rejects.toThrow(/AI rate limit exceeded/);
  });
});

describe("evidence integrity lifecycle", () => {
  it("generation ≠ verification, mismatch persists, re-baseline is explicit and history-preserving", async () => {
    const t = as(base(), "lifecycle-owner");
    await createCase(t, "JAAL-530");
    const evId = await insertEvidence(t, "JAAL-530");

    // 1. Verify with no baseline → honest "generated", NOT a verification.
    expect(await t.mutation(api.jaal.verifyEvidence, { evidenceId: evId })).toBe(
      "generated",
    );
    let doc = await readEvidence(t, evId);
    expect(doc.integrityStatus).toBe("HASH_GENERATED");
    expect(doc.integrityHash).toBeTruthy();

    // 2. Independent verification against the baseline → match.
    expect(await t.mutation(api.jaal.verifyEvidence, { evidenceId: evId })).toBe(
      "match",
    );
    doc = await readEvidence(t, evId);
    expect(doc.integrityStatus).toBe("INTEGRITY_VERIFIED");
    const originalHash = doc.integrityHash!;
    // The first pass had no baseline ("generated" is not a verification),
    // so exactly ONE real verification has been recorded so far.
    expect(doc.verificationHistory?.length).toBe(1);

    // 3. Tamper simulation: original snapshot + hash preserved, event recorded.
    await t.mutation(api.jaal.setEvidenceContent, {
      evidenceId: evId,
      content: "UPI ID: audit@okhdfc\nALTERED by simulation",
      reason: "integrity demo",
    });
    doc = await readEvidence(t, evId);
    expect(doc.integrityStatus).toBe("TAMPER_SIMULATION");
    expect(doc.tampered).toBe(true);
    expect(doc.originalContent).toContain("send it now");
    expect(doc.integrityHash).toBe(originalHash);
    expect(doc.contentHistory?.length).toBe(1);
    const events = await t.run(async (ctx) =>
      ctx.db
        .query("events")
        .withIndex("by_investigation", (q) =>
          q.eq("investigationId", doc!.investigationId),
        )
        .collect(),
    );
    expect(
      events.some((e) => e.title === "Tamper simulation applied"),
    ).toBe(true);

    // 4. Re-verification → mismatch, which persists as HASH_MISMATCH.
    expect(await t.mutation(api.jaal.verifyEvidence, { evidenceId: evId })).toBe(
      "mismatch",
    );
    doc = await readEvidence(t, evId);
    expect(doc.integrityStatus).toBe("HASH_MISMATCH");

    // 5. Rehashing never auto-verifies: generating on a mismatch refuses.
    await expect(
      t.mutation(api.jaal.generateHash, { evidenceId: evId }),
    ).rejects.toThrow(/integrity mismatch/i);
    doc = await readEvidence(t, evId);
    expect(doc.integrityStatus).toBe("HASH_MISMATCH");
    expect(doc.integrityHash).toBe(originalHash);

    // 6. Re-baseline requires a recorded reason.
    await expect(
      t.mutation(api.jaal.rebaselineEvidence, { evidenceId: evId, reason: "  " }),
    ).rejects.toThrow(/reason is required/i);

    // 7. Explicit re-baseline records a new hash but never verifies.
    await t.mutation(api.jaal.rebaselineEvidence, {
      evidenceId: evId,
      reason: "Approved content edit for demo scenario 4",
    });
    doc = await readEvidence(t, evId);
    expect(doc.integrityStatus).toBe("HASH_GENERATED");
    expect(doc.integrityHash).not.toBe(originalHash);
    // Original hash stays in history, and history records both actions.
    const actions = (doc.hashHistory ?? []).map((h) => h.action);
    expect(actions).toContain("generated");
    expect(actions).toContain("superseded");
    expect(actions).toContain("rebaselined");
    expect(
      (doc.hashHistory ?? []).some((h) => h.hash === originalHash),
    ).toBe(true);
    // Tamper marker and original snapshot survive re-baselining, and the
    // earlier match+mismatch verification records are still on file.
    expect(doc.tampered).toBe(true);
    expect(doc.originalContent).toContain("send it now");
    expect(doc.verificationHistory).toHaveLength(2);
    expect(doc.verificationHistory!.map((v) => v.status)).toEqual([
      "INTEGRITY_VERIFIED",
      "HASH_MISMATCH",
    ]);

    // 8. Only a fresh verification marks it verified again.
    expect(await t.mutation(api.jaal.verifyEvidence, { evidenceId: evId })).toBe(
      "match",
    );
    doc = await readEvidence(t, evId);
    expect(doc.integrityStatus).toBe("INTEGRITY_VERIFIED");
  });

  it("re-baseline refuses when content still matches the recorded hash", async () => {
    const t = as(base(), "rebaseline-noop-owner");
    await createCase(t, "JAAL-531");
    const evId = await insertEvidence(t, "JAAL-531");
    await t.mutation(api.jaal.generateHash, { evidenceId: evId });
    await expect(
      t.mutation(api.jaal.rebaselineEvidence, {
        evidenceId: evId,
        reason: "should not be allowed without a mismatch",
      }),
    ).rejects.toThrow(/no re-baseline needed/i);
    const doc = await readEvidence(t, evId);
    expect(doc.integrityStatus).toBe("HASH_GENERATED");
    expect(doc.hashHistory ?? []).toHaveLength(1);
  });
});

describe("transcript import honesty", () => {
  it("reports unparsed lines instead of claiming full success", async () => {
    const t = as(base(), "import-owner");
    const res = await t.mutation(api.jaal.createInvestigation, {
      caseId: "JAAL-540",
      title: "Mixed format import",
      category: "UPI/payment scam",
      description: "Import with a line that cannot be parsed.",
      source: "import",
      detectionMode: "balanced",
      flags: { ...FLAGS },
      transcript: [
        "Scammer: Send the fee to audit@okhdfc",
        "Me: I will not pay anything",
        "!!!garbage line without a sender",
        "Scammer: This is your final warning",
      ].join("\n"),
    });
    expect(res.caseId).toBe("JAAL-540");
    expect(res.import).toBeTruthy();
    expect(res.import!.parsedMessages).toBe(3);
    // The unparsed line is counted and surfaced, not silently dropped.
    expect(res.import!.unparsedLines + res.import!.warnings.length).toBeGreaterThan(0);
    expect(res.import!.messagesImported).toBeGreaterThanOrEqual(3);
  });
});
