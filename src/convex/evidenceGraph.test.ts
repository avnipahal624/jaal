import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";
import type { EvidenceGraph } from "@/types/evidenceGraph";

/**
 * Evidence graph tests — the graph is a read-only projection of persisted
 * records, so these exercise the real Convex functions against the mock
 * runtime and cross-check every node/edge against the underlying rows.
 */

const FLAGS = {
  tacticDetection: true,
  identifierExtraction: true,
  integrityHashing: true,
  aiSuggestions: true,
} as const;

function setup() {
  // Evidence graph queries are owner-scoped; use a synthetic test identity.
  return convexTest(schema, modules).withIdentity({ subject: "graph-test-operator" });
}

type T = ReturnType<typeof setup>;

async function createCase(t: T, caseId = "JAAL-200", subject?: string) {
  const user = subject ? t.withIdentity({ subject }) : t;
  await user.mutation(api.jaal.createInvestigation, {
    caseId,
    title: "Graph test case",
    category: "UPI/payment scam",
    description: "Synthetic graph assembly test.",
    notes: "Synthetic identifiers only.",
    source: "simulation",
    detectionMode: "simulation",
    flags: { ...FLAGS },
  });
  return user;
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

async function openerMessageId(t: T, caseId: string): Promise<Id<"messages">> {
  const investigationId = await invId(t, caseId);
  const doc = await t.run(async (ctx) =>
    ctx.db
      .query("messages")
      .withIndex("by_investigation", (q) =>
        q.eq("investigationId", investigationId),
      )
      .first(),
  );
  if (!doc) throw new Error("no seeded opener");
  return (doc as Doc<"messages">)._id;
}

async function insertEvidence(
  t: T,
  caseId: string,
  opts: {
    value: string;
    label?: string;
    sourceMessageId?: string;
  },
): Promise<Id<"evidence">> {
  const investigationId = await invId(t, caseId);
  return t.run(async (ctx) => {
    const inv = (await ctx.db.get(investigationId))!;
    return ctx.db.insert("evidence", {
      investigationId: inv._id,
      owner: inv.owner,
      caseId,
      sourceMessageId: opts.sourceMessageId,
      sourceMessageText: "persisted source line",
      label: opts.label ?? "UPI ID",
      evidenceType: "upi",
      extractedValue: opts.value,
      normalizedValue: opts.value.toLowerCase(),
      content: `content-${opts.value}`,
      extractionMethod: "TEST_REGEX",
      extractionTimestamp: 1_000,
      integrityStatus: "NOT_HASHED",
      notes: "",
      createdAt: 1_000,
    });
  });
}

async function insertTactic(
  t: T,
  caseId: string,
  messageId?: string,
): Promise<Id<"tactics">> {
  const investigationId = await invId(t, caseId);
  return t.run(async (ctx) => {
    const inv = (await ctx.db.get(investigationId))!;
    return ctx.db.insert("tactics", {
      investigationId: inv._id,
      owner: inv.owner,
      caseId,
      tactic: "urgency",
      messageId,
      sourceText: "do it now",
      timestamp: 1_000,
      explanation: "pressure language detected",
    });
  });
}

/** Structural invariants every graph must satisfy. */
function assertEdgeValidity(graph: EvidenceGraph) {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  for (const e of graph.edges) {
    expect(nodeIds.has(e.from), `edge ${e.id} from-node exists`).toBe(true);
    expect(nodeIds.has(e.to), `edge ${e.id} to-node exists`).toBe(true);
    expect(e.sourceRecordId.length).toBeGreaterThan(0);
    expect(e.basis.length).toBeGreaterThan(0);
    expect(e.id).toBe(`${e.type}:${e.from}->${e.to}`);
  }
}

function indicatorByValue(graph: EvidenceGraph, value: string) {
  const node = graph.nodes.find(
    (n) => n.type === "indicator" && (n.data as { value: string }).value === value,
  );
  if (!node) throw new Error(`no indicator node for ${value}`);
  return node;
}

describe("evidenceGraph.getByInvestigation", () => {
  it("builds all four node types from persisted records, cross-checked against the tables", async () => {
    const t = setup();
    const user = await createCase(t);
    await user.mutation(api.jaal.sendMessage, {
      caseId: "JAAL-200",
      text: "Why is a payment required?",
    });
    const graph: EvidenceGraph = await user.query(
      api.evidenceGraph.getByInvestigation,
      { investigationId: "JAAL-200" },
    );

    const types = new Set(graph.nodes.map((n) => n.type));
    expect(types.has("message")).toBe(true);
    expect(types.has("indicator")).toBe(true);
    expect(types.has("evidence")).toBe(true);
    expect(types.has("tactic")).toBe(true);

    // Every node maps 1:1 to a persisted record of this investigation.
    // (Tactic client ids are composite `tactic:messageId` — cross-check the
    // graph against the tactics table itself, which is the source of truth.)
    const state = await user.query(api.jaal.state);
    const rt = state.sessions["JAAL-200"]!;
    const msgIds = new Set(
      rt.messages.filter((m) => m.author !== "system").map((m) => m.id),
    );
    const evIds = new Set(rt.evidence.map((e) => e.id));
    const taIds = new Set(
      (
        await t.run((ctx) => ctx.db.query("tactics").collect())
      ).map((d) => d._id as string),
    );
    for (const n of graph.nodes) {
      if (n.type === "message") expect(msgIds.has(n.recordId)).toBe(true);
      if (n.type === "indicator" || n.type === "evidence")
        expect(evIds.has(n.recordId)).toBe(true);
      if (n.type === "tactic") expect(taIds.has(n.recordId)).toBe(true);
    }
    // Indicator and evidence nodes are two aspects of the same rows.
    const indRecords = graph.nodes
      .filter((n) => n.type === "indicator")
      .map((n) => n.recordId)
      .sort();
    const eviRecords = graph.nodes
      .filter((n) => n.type === "evidence")
      .map((n) => n.recordId)
      .sort();
    expect(indRecords).toEqual(eviRecords);

    expect(graph.investigationId).toBe("JAAL-200");
    expect(graph.version).toBe(1);
    expect(graph.generatedAt).toBeGreaterThan(0);
    assertEdgeValidity(graph);
  });

  it("produces stable node and edge ids across repeated queries", async () => {
    const t = setup();
    const user = await createCase(t);
    await user.mutation(api.jaal.sendMessage, {
      caseId: "JAAL-200",
      text: "Why is a payment required?",
    });
    const args = { investigationId: "JAAL-200" };
    const a: EvidenceGraph = await user.query(
      api.evidenceGraph.getByInvestigation,
      args,
    );
    const b: EvidenceGraph = await user.query(
      api.evidenceGraph.getByInvestigation,
      args,
    );
    expect(a.nodes.map((n) => n.id)).toEqual(b.nodes.map((n) => n.id));
    expect(a.edges.map((e) => e.id)).toEqual(b.edges.map((e) => e.id));
    for (const n of a.nodes) {
      expect(n.id).toMatch(/^(msg|ind|tac|evi):/);
      expect(n.id).toBe(`${n.id.split(":")[0]}:${n.recordId}`);
    }
    // No duplicate ids.
    expect(new Set(a.nodes.map((n) => n.id)).size).toBe(a.nodes.length);
    expect(new Set(a.edges.map((e) => e.id)).size).toBe(a.edges.length);
  });

  it("emits PRESERVED_AS per evidence row and only data-supported message edges", async () => {
    const t = setup();
    const user = await createCase(t);
    await user.mutation(api.jaal.sendMessage, {
      caseId: "JAAL-200",
      text: "Why is a payment required?",
    });
    const graph: EvidenceGraph = await user.query(
      api.evidenceGraph.getByInvestigation,
      { investigationId: "JAAL-200" },
    );
    const state = await user.query(api.jaal.state);
    const rt = state.sessions["JAAL-200"]!;

    const preserved = graph.edges.filter((e) => e.type === "PRESERVED_AS");
    expect(preserved).toHaveLength(rt.evidence.length);
    for (const e of graph.edges.filter((x) => x.type === "EXTRACTED_FROM")) {
      expect(rt.evidence.some((ev) => ev.id === e.sourceRecordId)).toBe(true);
    }
    const tacticRecordIds = new Set(
      (await t.run((ctx) => ctx.db.query("tactics").collect())).map(
        (d) => d._id as string,
      ),
    );
    for (const e of graph.edges.filter((x) => x.type === "DETECTED_IN")) {
      expect(tacticRecordIds.has(e.sourceRecordId)).toBe(true);
      const msgNode = graph.nodes.find((n) => n.id === e.to)!;
      expect(msgNode.type).toBe("message");
    }
    assertEdgeValidity(graph);
  });

  it("links co-extracted indicators with ASSOCIATED_WITH citing the shared message", async () => {
    const t = setup();
    await createCase(t);
    const opener = await openerMessageId(t, "JAAL-200");
    await insertEvidence(t, "JAAL-200", {
      value: "scam.upi@aap",
      sourceMessageId: opener,
    });
    await insertEvidence(t, "JAAL-200", {
      value: "+91 90000 00000",
      label: "Phone",
      sourceMessageId: opener,
    });
    // Unrelated third indicator — must not join the pair.
    await insertEvidence(t, "JAAL-200", { value: "lonely.upi@bop" });

    const graph: EvidenceGraph = await t.query(
      api.evidenceGraph.getByInvestigation,
      { investigationId: "JAAL-200" },
    );
    const assoc = graph.edges.filter((e) => e.type === "ASSOCIATED_WITH");
    expect(assoc).toHaveLength(1);
    // Basis: the shared persisted message both were extracted from.
    expect(assoc[0]!.sourceRecordId).toBe(opener);

    const pair = new Set([assoc[0]!.from, assoc[0]!.to]);
    expect(pair).toEqual(
      new Set([
        indicatorByValue(graph, "scam.upi@aap").id,
        indicatorByValue(graph, "+91 90000 00000").id,
      ]),
    );
    // The lonely indicator (no source message) is in no association.
    const lonely = indicatorByValue(graph, "lonely.upi@bop");
    expect(pair.has(lonely.id)).toBe(false);
    assertEdgeValidity(graph);
  });

  it("drops edges whose source record does not resolve, while keeping the nodes", async () => {
    const t = setup();
    await createCase(t);
    const bogus = "msg_does_not_exist";
    const ghostEvidenceId = await insertEvidence(t, "JAAL-200", {
      value: "ghost.upi@nowhere",
      sourceMessageId: bogus,
    });
    const ghostTacticId = await insertTactic(t, "JAAL-200", bogus);

    const graph: EvidenceGraph = await t.query(
      api.evidenceGraph.getByInvestigation,
      { investigationId: "JAAL-200" },
    );
    // Nodes exist (real records) …
    expect(graph.nodes.some((n) => n.id === `ind:${ghostEvidenceId}`)).toBe(true);
    expect(graph.nodes.some((n) => n.id === `evi:${ghostEvidenceId}`)).toBe(true);
    expect(graph.nodes.some((n) => n.id === `tac:${ghostTacticId}`)).toBe(true);
    // … and no edge references the missing message or the unlinked records.
    expect(graph.edges.some((e) => e.from.includes(bogus) || e.to.includes(bogus))).toBe(
      false,
    );
    expect(
      graph.edges.filter((e) => e.type === "EXTRACTED_FROM" && e.from === `ind:${ghostEvidenceId}`),
    ).toHaveLength(0);
    expect(
      graph.edges.filter((e) => e.type === "DETECTED_IN" && e.from === `tac:${ghostTacticId}`),
    ).toHaveLength(0);
    // PRESERVED_AS remains valid — same-row basis, no message involved.
    expect(
      graph.edges.filter((e) => e.type === "PRESERVED_AS" && e.from === `ind:${ghostEvidenceId}`),
    ).toHaveLength(1);
    assertEdgeValidity(graph);
  });

  it("keeps investigations isolated from each other and from other owners", async () => {
    const t = setup();
    const alice = t.withIdentity({ subject: "alice" });
    const bob = t.withIdentity({ subject: "bob" });

    await createCase(t, "JAAL-201", "alice");
    await alice.mutation(api.jaal.sendMessage, {
      caseId: "JAAL-201",
      text: "Why is a payment required?",
    });
    await createCase(t, "JAAL-202", "bob");
    await bob.mutation(api.jaal.sendMessage, {
      caseId: "JAAL-202",
      text: "Why is a payment required?",
    });

    const aliceGraph: EvidenceGraph = await alice.query(
      api.evidenceGraph.getByInvestigation,
      { investigationId: "JAAL-201" },
    );
    expect(aliceGraph.nodes.length).toBeGreaterThan(0);
    // Same-owner other case: its records must not leak into this graph.
    const state = await alice.query(api.jaal.state);
    const thisCaseEvidence = new Set(
      state.sessions["JAAL-201"]!.evidence.map((e) => e.id),
    );
    for (const n of aliceGraph.nodes) {
      if (n.type === "indicator" || n.type === "evidence") {
        expect(thisCaseEvidence.has(n.recordId)).toBe(true);
      }
    }

    // Bob cannot see Alice's graph — empty, not an error.
    const bobView: EvidenceGraph = await bob.query(
      api.evidenceGraph.getByInvestigation,
      { investigationId: "JAAL-201" },
    );
    expect(bobView.nodes).toHaveLength(0);
    expect(bobView.edges).toHaveLength(0);
    expect(bobView.investigationId).toBe("JAAL-201");
    expect(bobView.version).toBe(1);
  });

  it("returns an empty but valid contract for an investigation with no case data", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("investigations", {
        caseId: "JAAL-EMPTY",
        owner: "demo",
        title: "Empty",
        category: "Other",
        description: "No messages, evidence or tactics.",
        notes: "",
        status: "active",
        source: "simulation",
        detectionMode: "simulation",
        flags: { ...FLAGS },
        currentStage: "contact",
        createdAt: 1,
        lastActivityAt: 1,
        runStatus: "running",
        startedAt: 1,
        cursor: 0,
        turnCount: 0,
        stages: [],
        schemaVersion: 1,
      });
    });
    const graph: EvidenceGraph = await t.query(
      api.evidenceGraph.getByInvestigation,
      { investigationId: "JAAL-EMPTY" },
    );
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
    expect(graph.investigationId).toBe("JAAL-EMPTY");
    expect(graph.version).toBe(1);
    expect(graph.generatedAt).toBeGreaterThan(0);
  });

  it("returns an empty graph for an unknown case", async () => {
    const t = setup();
    const graph: EvidenceGraph = await t.query(
      api.evidenceGraph.getByInvestigation,
      { investigationId: "JAAL-NOPE" },
    );
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });
});
