import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { SAMPLE_SPOTS } from "../../src/esau/fixtures/spots";
import { askClaude } from "./ask";

function fakeClient(reply: Record<string, unknown>) {
  const calls: any[] = [];
  const client = {
    beta: {
      messages: {
        parse: async (params: any) => {
          calls.push(params);
          return {
            model: "claude-opus-5-5",
            stop_reason: "end_turn",
            usage: { input_tokens: 900, output_tokens: 120, cache_read_input_tokens: 3000 },
            parsed_output: {
              say: "That bench is where I'd look for him.",
              more: "Bucks bed with the wind at their back. That is why.",
              headline: "Bench bed",
              confidence: "fair",
              spotRole: "bedding",
              marks: [1, 2, 3, 4, 5].map((n) => ({ kind: "bedding", lat: SAMPLE_SPOTS[0]!.query.spot.lat, lng: SAMPLE_SPOTS[0]!.query.spot.lng, label: `m${n}` })),
              wouldChangeMyMind: ["a", "b", "c", "d"],
            },
            ...reply,
          };
        },
      },
    },
  };
  return { client: client as unknown as Anthropic, calls };
}

describe("askClaude", () => {
  it("sends a cached system prompt, the field report, effort and refusal fallbacks", async () => {
    const { client, calls } = fakeClient({});
    const r = await askClaude(SAMPLE_SPOTS[0]!.query, { client });
    const p = calls[0];
    expect(p.model).toBe("claude-opus-5-5");
    expect(p.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(p.system[0].text).toContain("You are Esau");
    expect(p.messages[0].content.at(-1).text).toContain("FIELD REPORT");
    expect(p.output_config.effort).toBe("low");
    expect(p.fallbacks).toBe("default");
    expect(p.betas).toContain("server-side-fallback-2026-07-01");
    expect(r.say).toContain("bench");
    expect(r.marks).toHaveLength(4);
    expect(r.wouldChangeMyMind).toHaveLength(3);
    expect(r.meta.inputTokens).toBe(3900);
  });
  it("logs a rule slip, like talking turkey to a deer hunter, without changing the answer", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const parsed = { say: "Watch for gobblers on the ridge.", more: "", headline: "h", confidence: "fair", spotRole: "travel", marks: [], wouldChangeMyMind: [] };
    const { client } = fakeClient({ parsed_output: parsed });
    const r = await askClaude(SAMPLE_SPOTS[0]!.query, { client });
    expect(r.say).toBe("Watch for gobblers on the ridge.");
    expect(warn).toHaveBeenCalledWith("Esau rule check:", expect.stringMatching(/turkey/));
    warn.mockRestore();
  });
  it("thinks harder when the hunter asks a question", async () => {
    const { client, calls } = fakeClient({});
    await askClaude(SAMPLE_SPOTS[5]!.query, { client });
    await askClaude({ ...SAMPLE_SPOTS[0]!.query, question: "Where do I sit?" }, { client });
    expect(calls[0].output_config.effort).toBe("medium");
    expect(calls[1].output_config.effort).toBe("medium");
    expect(calls[1].messages[0].content[0].type).toBe("text");
  });
  it("moves sentences past the fourth behind Teach me more", async () => {
    const { client } = fakeClient({
      parsed_output: { say: "One. Two. Three. Four. Five.", more: "Six.", headline: "h", confidence: "fair", spotRole: "bedding", marks: [], wouldChangeMyMind: [] },
    });
    const r = await askClaude(SAMPLE_SPOTS[0]!.query, { client });
    expect(r.say).toBe("One. Two. Three. Four.");
    expect(r.more).toBe("Five. Six.");
  });
  it("drops map pins at coordinates the read never mentioned", async () => {
    const at = SAMPLE_SPOTS[0]!.query.spot;
    const { client } = fakeClient({
      parsed_output: {
        say: "s", more: "", headline: "h", confidence: "fair", spotRole: "bedding", wouldChangeMyMind: [],
        marks: [
          { kind: "bedding", lat: 10, lng: 10, label: "made up" },
          { kind: "stand", lat: at.lat, lng: at.lng, label: "here" },
        ],
      },
    });
    const r = await askClaude(SAMPLE_SPOTS[0]!.query, { client });
    expect(r.marks.map((m) => m.label)).toEqual(["here"]);
  });
  it("answers a refusal in Esau's voice instead of throwing", async () => {
    const { client } = fakeClient({ stop_reason: "refusal", parsed_output: null });
    const r = await askClaude(SAMPLE_SPOTS[0]!.query, { client });
    expect(r.headline).toBe("Can't help with that");
  });
});
