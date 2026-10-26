"use node";

/**
 * AI service — Anthropic Claude integration for JAAL.
 *
 * These are the ONLY functions that may read the LLM API key
 * (ANTHROPIC_API_KEY / ANTHROPIC_MODEL deployment env vars). They run in the
 * Node runtime as Convex actions, so secrets never reach the browser.
 *
 * Every path is fail-safe: when no key is configured, or the provider errors
 * or returns invalid output, the caller receives a clearly labeled
 * SIMULATION fallback so the deterministic rule engine keeps the app fully
 * usable. No response is ever fabricated to look like model output.
 */
import { action } from "./_generated/server";
import { v } from "convex/values";
import { z } from "zod";

async function requireAuthenticated(ctx: {
  auth: { getUserIdentity(): Promise<{ subject: string } | null> };
}): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new Error("Authentication required to use JAAL AI actions.");
  }
}

const SUGGESTION_SCHEMA = z.object({
  objective: z.string().min(1).max(300),
  informationGap: z.string().min(1).max(300),
  suggestedQuestion: z.string().min(1).max(300),
  reason: z.string().min(1).max(400),
});

type Suggestion = z.infer<typeof SUGGESTION_SCHEMA>;

const SYSTEM_PROMPT = `You are the investigation strategy engine for JAAL, a scam-analysis training platform running a CONTROLLED SIMULATION. You never contact real people; all conversations are synthetic.

Given a transcript of a simulated scam conversation, propose the single best next decoy question the investigator should ask. The question should:
- seek a concrete, documentable detail (department, case reference, official link, payment pretext, UPI handle);
- avoid repeating questions already asked;
- never send money, share personal information, or claim real authority.

Return ONLY a JSON object:
{"objective": "what the scammer is currently trying to achieve",
 "informationGap": "what remains unknown to the investigation",
 "suggestedQuestion": "the exact next question to send",
 "reason": "why this question clarifies the scam"}`;

async function callClaude(
  apiKey: string,
  userContent: string,
  maxTokens: number,
): Promise<string | null> {
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
    // Hard timeout: a hung provider request must fall back to SIMULATION,
    // not stall the action until Convex's runtime limit.
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}`);
  }
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content?.find((c) => c.type === "text")?.text;
  return text ?? null;
}

function extractJson(text: string): unknown | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * Generate the next investigation strategy for a transcript.
 * Returns { engineMode: "SIMULATION", suggestion: null } when no key is
 * configured so the caller uses the deterministic rule engine instead.
 */
export const strategyAction = action({
  args: {
    transcript: v.array(
      v.object({
        author: v.union(
          v.literal("scammer"),
          v.literal("decoy"),
          v.literal("system"),
        ),
        text: v.string(),
      }),
    ),
    activeStage: v.string(),
  },
  handler: async (ctx, args): Promise<{
    engineMode: string;
    suggestion: Suggestion | null;
    fallbackReason?: string;
  }> => {
    await requireAuthenticated(ctx);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { engineMode: "SIMULATION", suggestion: null };
    }
    try {
      const convo = args.transcript
        .map((m) => `${m.author.toUpperCase()}: ${m.text}`)
        .join("\n");
      const text = await callClaude(
        apiKey,
        `Current kill-chain stage: ${args.activeStage}\n\nTranscript:\n${convo}`,
        400,
      );
      if (!text) {
        return {
          engineMode: "SIMULATION",
          suggestion: null,
          fallbackReason: "empty model response",
        };
      }
      const parsed = SUGGESTION_SCHEMA.safeParse(extractJson(text));
      if (!parsed.success) {
        return {
          engineMode: "SIMULATION",
          suggestion: null,
          fallbackReason: "model returned invalid structured output",
        };
      }
      return { engineMode: "ANTHROPIC", suggestion: parsed.data };
    } catch (err) {
      return {
        engineMode: "SIMULATION",
        suggestion: null,
        fallbackReason: err instanceof Error ? err.message : "provider error",
      };
    }
  },
});

/**
 * Optional LLM summary for a generated report. Returns null when no key is
 * configured or the provider fails — the caller keeps the deterministic
 * summary built from actual analysis records.
 */
export const summaryAction = action({
  args: {
    title: v.string(),
    category: v.string(),
    transcript: v.array(
      v.object({ author: v.string(), text: v.string() }),
    ),
    tactics: v.array(v.string()),
    stages: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<{ summary: string; engineMode: string } | null> => {
    await requireAuthenticated(ctx);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    try {
      const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          model,
          max_tokens: 500,
          system:
            "You summarize CONTROLLED SIMULATION scam-investigation transcripts for JAAL, a training platform. Never invent facts not present in the transcript. Return 2-3 plain sentences describing the scam arc, the tactics observed and the payment pressure applied. No preamble.",
          messages: [
            {
              role: "user",
              content: `Case: ${args.title} (${args.category})\nDetected tactics: ${args.tactics.join(", ") || "none"}\nKill-chain reached: ${args.stages.join(", ") || "none"}\n\nTranscript:\n${args.transcript
                .map((m) => `${m.author}: ${m.text}`)
                .join("\n")}`,
            },
          ],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        content?: { type: string; text?: string }[];
      };
      const summary = data.content?.find((c) => c.type === "text")?.text;
      if (!summary) return null;
      return { summary: summary.trim(), engineMode: "ANTHROPIC" };
    } catch {
      return null;
    }
  },
});
