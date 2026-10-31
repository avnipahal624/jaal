import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

/**
 * Evidence-correlation review tests (Part 5.6, Part 10.3, Workflow D).
 *
 * AI suggestions are never confirmed on their own: the investigator must
 * accept or reject each one, the decision is authenticated and
 * owner-scoped, acceptance re-validates BOTH endpoints against the caller's
 * own investigation, and rejection never touches evidence.
 *
 * All scenario data is synthetic.
 */

const FLAGS = {
  tacticDetection: true,
  identifierExtraction: true,
  integrityHashing: true,
  aiSuggestions: true,
} as const;

const NOT_AUTHENTICATED =
  "Not authenticated — an identity is required to access JAAL data.";
const NOT_FOUND = "Suggestion not found";

function base() {
  return convexTest(schema, modules);
}
type Base = ReturnType<typeof base>;

function as(t: Base, subject: string) {
  return t.withIdentity({ subject });
}
type T = ReturnType<typeof as>;

async function createCase(t: T, caseId: string) {
  await t.mutation(api.jaal.createInvestigation, {
    caseId,
    title: "Correlation review case",
    category: "Digital arrest scam",
    description: "Synthetic case for correlation review tests.",
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

/** Insert two evidence rows so a suggestion can reference real endpoints. */
async function insertEvidencePair(t: T, caseId: string) {
  const investigationId = await invId(t, caseId);
  return t.run(async (ctx) => {
    const inv = (await ctx.db.get(investigationId))!;
    const a = await ctx.db.insert("evidence", {
      investigationId: inv._id,
      owner: inv.owner,
      caseId,
      sourceMessageText: "synthetic source line",
      label: "UPI ID",
      evidenceType: "upi",
      extractedValue: "audit@okhdfc",
      normalizedValue: "audit@okhdfc",
      content: "UPI ID: audit@okhdfc",
      extractionMethod: "RULE_BASED_REGEX:upi_vpa",
      extractionTimestamp: 1_000,
      integrityStatus: "NOT_HASHED",
      notes: "",
      createdAt: 1_000,
    });
    const b = await ctx.db.insert("evidence", {
      investigationId: inv._id,
      owner: inv.owner,
      caseId,
      sourceMessageText: "synthetic source line",
      label: "UPI ID",
      evidenceType: "upi",
      extractedValue: "refund@okaxis",
      normalizedValue: "refund@okaxis",
      content: "UPI ID: refund@okaxis",
      extractionMethod: "RULE_BASED_REGEX:upi_vpa",
      extractionTimestamp: 1_000,
      integrityStatus: "NOT_HASHED",
      notes: "",
      createdAt: 1_000,
    });
    return { a, b };
  });
}

interface SuggestionPatch {
  source?: { kind: string; id: string; label: string };
  target?: { kind: string; id: string; label: string };
  status?: "PENDING_REVIEW" | "ACCEPTED" | "REJECTED";
  owner?: string;
}

async function insertSuggestion(
  t: T,
  caseId: string,
  ids: { a: Id<"evidence">; b: Id<"evidence"> },
  patch: SuggestionPatch = {},
): Promise<Id<"correlation_suggestions">> {
  const investigationId = await invId(t, caseId);
  return t.run(async (ctx) => {
    const inv = (await ctx.db.get(investigationId))!;
    return ctx.db.insert("correlation_suggestions", {
      investigationId: inv._id,
      owner: patch.owner ?? inv.owner,
      caseId,
      source: patch.source ?? {
        kind: "indicator",
        id: ids.a,
        label: "UPI ID: audit@okhdfc",
      },
      target: patch.target ?? {
        kind: "indicator",
        id: ids.b,
        label: "UPI ID: refund@okaxis",
      },
      relation: "REPEATED_IDENTIFIER",
      category: "Repeated identifier",
      explanation: "Both identifiers appear in payment-related messages.",
      messageRefs: [],
      evidenceRefs: [ids.a],
      confidence: "high",
      origin: "AI",
      status: patch.status ?? "PENDING_REVIEW",
      fingerprint: "m1:1000:e2:1000:t0",
      at: 1_000,
    });
  });
}

async function readSuggestion(t: T, id: Id<"correlation_suggestions">) {
  return (await t.run((ctx) => ctx.db.get(id))) as Doc<"correlation_suggestions">;
}

async function countRows(t: T, table: "correlations" | "evidence") {
  return t.run(async (ctx) => (await ctx.db.query(table).collect()).length);
}

describe("unauthenticated correlation review", () => {
  it("rejects an accept attempt with no identity", async () => {
    const env = base();
    const t = await createCase(as(env, "owner-a"), "JAAL-610");
    const ids = await insertEvidencePair(t, "JAAL-610");
    const suggestionId = await insertSuggestion(t, "JAAL-610", ids);

    await expect(
      env.mutation(api.intelligence.reviewSuggestion, {
        suggestionId,
        decision: "accept",
      }),
    ).rejects.toThrow(NOT_AUTHENTICATED);

    expect((await readSuggestion(t, suggestionId)).status).toBe(
      "PENDING_REVIEW",
    );
  });

  it("rejects a reject attempt with no identity", async () => {
    const env = base();
    const t = await createCase(as(env, "owner-a"), "JAAL-611");
    const ids = await insertEvidencePair(t, "JAAL-611");
    const suggestionId = await insertSuggestion(t, "JAAL-611", ids);

    await expect(
      env.mutation(api.intelligence.reviewSuggestion, {
        suggestionId,
        decision: "reject",
      }),
    ).rejects.toThrow(NOT_AUTHENTICATED);

    expect((await readSuggestion(t, suggestionId)).status).toBe(
      "PENDING_REVIEW",
    );
  });
});

describe("cross-owner isolation", () => {
  it("a second identity can neither accept nor reject another owner's suggestion", async () => {
    const t = await createCase(as(base(), "owner-a"), "JAAL-612");
    const ids = await insertEvidencePair(t, "JAAL-612");
    const suggestionId = await insertSuggestion(t, "JAAL-612", ids);
    const intruder = t.withIdentity({ subject: "owner-b" });

    await expect(
      intruder.mutation(api.intelligence.reviewSuggestion, {
        suggestionId,
        decision: "accept",
      }),
    ).rejects.toThrow(NOT_FOUND);

    await expect(
      intruder.mutation(api.intelligence.reviewSuggestion, {
        suggestionId,
        decision: "reject",
      }),
    ).rejects.toThrow(NOT_FOUND);

    const row = await readSuggestion(t, suggestionId);
    expect(row.status).toBe("PENDING_REVIEW");
    expect(row.reviewer).toBeUndefined();
    expect(await countRows(t, "correlations")).toBe(0);
  });
});

describe("investigator approval creates the confirmed relationship", () => {
  it("acceptance confirms the suggestion and records the review event", async () => {
    const t = await createCase(as(base(), "owner-a"), "JAAL-613");
    const ids = await insertEvidencePair(t, "JAAL-613");
    const suggestionId = await insertSuggestion(t, "JAAL-613", ids);

    const res = await t.mutation(api.intelligence.reviewSuggestion, {
      suggestionId,
      decision: "accept",
      note: "Both identifiers sit in the same payment thread.",
    });
    expect(res.status).toBe("ACCEPTED");

    const row = await readSuggestion(t, suggestionId);
    expect(row.status).toBe("ACCEPTED");
    expect(row.reviewer).toBe("owner-a");
    expect(row.reviewedAt).toBeGreaterThan(0);
    expect(row.reviewNote).toContain("same payment thread");

    const links = await t.run((ctx) => ctx.db.query("correlations").collect());
    expect(links).toHaveLength(1);
    expect(links[0].acceptedBy).toBe("owner-a");
    expect(links[0].suggestionId).toBe(suggestionId);
    expect(links[0].basis).toContain("AI suggestion");

    const events = await t.run((ctx) => ctx.db.query("events").collect());
    expect(
      events.some(
        (e) => e.title === "Relationship confirmed" && e.owner === "owner-a",
      ),
    ).toBe(true);
  });

  it("rejection records the decision and creates no relationship", async () => {
    const t = await createCase(as(base(), "owner-a"), "JAAL-614");
    const ids = await insertEvidencePair(t, "JAAL-614");
    const suggestionId = await insertSuggestion(t, "JAAL-614", ids);

    const res = await t.mutation(api.intelligence.reviewSuggestion, {
      suggestionId,
      decision: "reject",
      note: "Coincidence — different actors.",
    });
    expect(res.status).toBe("REJECTED");

    const row = await readSuggestion(t, suggestionId);
    expect(row.status).toBe("REJECTED");
    expect(row.reviewer).toBe("owner-a");
    expect(await countRows(t, "correlations")).toBe(0);
    expect(await countRows(t, "evidence")).toBe(2);
  });

  it("a suggestion can only be reviewed once", async () => {
    const t = await createCase(as(base(), "owner-a"), "JAAL-615");
    const ids = await insertEvidencePair(t, "JAAL-615");
    const suggestionId = await insertSuggestion(t, "JAAL-615", ids);

    await t.mutation(api.intelligence.reviewSuggestion, {
      suggestionId,
      decision: "accept",
    });

    await expect(
      t.mutation(api.intelligence.reviewSuggestion, {
        suggestionId,
        decision: "reject",
      }),
    ).rejects.toThrow(/already ACCEPTED/);

    expect(await countRows(t, "correlations")).toBe(1);
  });

  it("acceptance re-validates both endpoints against the caller's case", async () => {
    const env = base();
    const t = await createCase(as(env, "owner-a"), "JAAL-616");
    const ids = await insertEvidencePair(t, "JAAL-616");

    // A different owner's evidence row — must never be linkable to this case.
    await createCase(as(env, "owner-b"), "JAAL-617");
    const foreignEvidenceId = await t.run(async (ctx) => {
      const inv = await ctx.db
        .query("investigations")
        .filter((q) => q.eq(q.field("caseId"), "JAAL-617"))
        .first();
      return ctx.db.insert("evidence", {
        investigationId: (inv as Doc<"investigations">)._id,
        owner: "owner-b",
        caseId: "JAAL-617",
        sourceMessageText: "foreign line",
        label: "UPI ID",
        evidenceType: "upi",
        extractedValue: "foreign@okicici",
        normalizedValue: "foreign@okicici",
        content: "UPI ID: foreign@okicici",
        extractionMethod: "RULE_BASED_REGEX:upi_vpa",
        extractionTimestamp: 1_000,
        integrityStatus: "NOT_HASHED",
        notes: "",
        createdAt: 1_000,
      });
    });

    const suggestionId = await insertSuggestion(t, "JAAL-616", ids, {
      target: {
        kind: "indicator",
        id: foreignEvidenceId,
        label: "UPI ID: foreign@okicici",
      },
    });

    await expect(
      t.mutation(api.intelligence.reviewSuggestion, {
        suggestionId,
        decision: "accept",
      }),
    ).rejects.toThrow(/outside this investigation/);

    expect((await readSuggestion(t, suggestionId)).status).toBe(
      "PENDING_REVIEW",
    );
    expect(await countRows(t, "correlations")).toBe(0);
  });

  it("two distinct suggestions for the same pair never create duplicate links", async () => {
    const t = await createCase(as(base(), "owner-a"), "JAAL-618");
    const ids = await insertEvidencePair(t, "JAAL-618");
    const first = await insertSuggestion(t, "JAAL-618", ids);
    const second = await insertSuggestion(t, "JAAL-618", ids);

    await t.mutation(api.intelligence.reviewSuggestion, {
      suggestionId: first,
      decision: "accept",
    });
    await t.mutation(api.intelligence.reviewSuggestion, {
      suggestionId: second,
      decision: "accept",
    });

    expect(await countRows(t, "correlations")).toBe(1);
    expect((await readSuggestion(t, first)).status).toBe("ACCEPTED");
    expect((await readSuggestion(t, second)).status).toBe("ACCEPTED");
  });
});
