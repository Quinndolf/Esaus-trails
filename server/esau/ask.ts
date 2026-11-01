import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { buildBrief, type EsauBrief } from "../../src/esau/brief";
import type { EsauReply, SpotQuery } from "../../src/esau/types";
import { splitAnswer } from "../../src/esau/answer";
import { EsauAnswer } from "./schema";

export const DEFAULT_MODEL = "claude-opus-5-5";

export interface AskConfig {
  client?: Anthropic;
  model?: string;
  /** Effort for a plain tap. Questions get one step more. */
  effort?: "low" | "medium" | "high";
}

const STEP_UP = { low: "medium", medium: "high", high: "high" } as const;

/** Ask Claude, as Esau, about one spot. Server-side only: needs ANTHROPIC_API_KEY. */
export async function askClaude(q: SpotQuery, cfg: AskConfig = {}): Promise<EsauReply> {
  const brief = buildBrief(q);
  return askWithBrief(q, brief, cfg);
}

export async function askWithBrief(q: SpotQuery, brief: EsauBrief, cfg: AskConfig = {}): Promise<EsauReply> {
  const client = cfg.client ?? new Anthropic();
  const model = cfg.model ?? process.env.ESAU_MODEL ?? DEFAULT_MODEL;
  const base = cfg.effort ?? ((process.env.ESAU_EFFORT as AskConfig["effort"]) || "low");
  const effort = q.question?.trim() ? STEP_UP[base] : base;

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  content.push({ type: "text", text: brief.report });

  const started = Date.now();
  const res = await client.beta.messages.parse({
    model,
    max_tokens: 8000,
    // Persona + species knowledge is identical for every tap on this species: cache it.
    system: [{ type: "text", text: brief.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { effort, format: zodOutputFormat(EsauAnswer) },
    // If a safety classifier declines, let the API retry on its recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  const ms = Date.now() - started;
  const meta = {
    model,
    servedBy: res.model,
    inputTokens: res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0),
    outputTokens: res.usage.output_tokens,
    ms,
  };

  if (res.stop_reason === "refusal") {
    return {
      more: "",
      say: "I can't help with that one. Ask me about the ground, the wind or the animal and I'll tell you what I see.",
      headline: "Can't help with that",
      confidence: "low",
      spotRole: "unlikely",
      marks: [],
      wouldChangeMyMind: [],
      meta,
    };
  }
  const out = res.parsed_output;
  if (!out) throw new Error(`Esau's answer didn't parse (stop_reason ${res.stop_reason})`);
  // The short read stays short: anything past four sentences moves behind "Teach me more".
  const { say, overflow } = splitAnswer(out.say);
  const more = [overflow, out.more.trim()].filter(Boolean).join(" ");
  return { ...out, say, more, marks: out.marks.slice(0, 4), wouldChangeMyMind: out.wouldChangeMyMind.slice(0, 3), meta };
}
