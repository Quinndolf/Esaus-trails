import { describe, expect, it } from "vitest";
import type { EsauReply, SpotQuery } from "../types";
import { checkReply } from "../check";
import { cell, hollowGrid } from "../fixtures/hollow";
import { SAMPLE_SPOTS } from "../fixtures/spots";
import { buildBrief } from "../brief";
import { offlineRead } from "../offline";

const g = hollowGrid();
const q = (over: Partial<SpotQuery> = {}): SpotQuery => ({ species: "whitetail", weapon: "bow", spot: cell(6, 16), grid: g, hourIndex: 0, timeZone: "America/Chicago", ...over });
const reply = (say: string, over: Partial<EsauReply> = {}): EsauReply =>
  ({ say, more: "", headline: "h", confidence: "fair", spotRole: "travel", marks: [], wouldChangeMyMind: [], meta: { model: "m", servedBy: "claude", inputTokens: 0, outputTokens: 0, ms: 0 }, ...over }) as EsauReply;

describe("checkReply: the rules every Esau answer must keep", () => {
  it("passes a short, on-topic deer answer", () => {
    expect(checkReply(q(), reply("Deer are bedded on the bench. Sit the saddle with the wind in your face."))).toEqual([]);
  });
  it("flags talk about an animal the hunter didn't pick", () => {
    expect(checkReply(q({ species: "squirrel", weapon: "pellet" }), reply("Squirrels are cutting hickories. Watch for a buck on the trail."))).toEqual([
      expect.stringMatching(/deer/i),
    ]);
  });
  it("flags a season date that isn't in the field report", () => {
    const p = checkReply(q(), reply("Archery runs until Feb. 30. Sit tight."));
    expect(p.join(" ")).toMatch(/Feb\. 30/);
  });
  it("accepts a date the field report gives", () => {
    expect(checkReply(q({ weapon: "rifle" }), reply("Modern gun opens Nov. 14, so leave the rifle home."))).toEqual([]);
  });
  it("flags a short read over four sentences", () => {
    expect(checkReply(q(), reply("One. Two. Three. Four. Five.")).join(" ")).toMatch(/sentences/);
  });
  it("flags a pin off the read ground", () => {
    const far = reply("Sit here.", { marks: [{ kind: "stand", label: "x", lat: g.north + 1, lng: g.west } as never] });
    expect(checkReply(q(), far).join(" ")).toMatch(/pin/i);
  });
  it("flags scent advice to a turkey hunter", () => {
    expect(checkReply(q({ species: "turkey", weapon: "shotgun" }), reply("Keep your scent off the roost.")).join(" ")).toMatch(/scent/i);
  });
  it("does not mistake verbs or another animal's sign for talk about that animal", () => {
    expect(checkReply(q({ species: "squirrel", weapon: "pellet" }), reply("Feeding does the trick here. That wind bears watching."))).toEqual([]);
    expect(checkReply(q({ species: "turkey", weapon: "shotgun" }), reply("Watch the deer trail for birds. Scent doesn't matter; turkeys go by eyesight."))).toEqual([]);
  });
  it("checks ordinal days and both ends of a range", () => {
    expect(checkReply(q({ weapon: "rifle" }), reply("Gun opens Nov. 15th.")).join(" ")).toMatch(/Nov\. 15th/);
    expect(checkReply(q({ weapon: "rifle" }), reply("Gun runs Nov. 14-30.")).join(" ")).toMatch(/14-30/);
    expect(checkReply(q({ weapon: "rifle" }), reply("Gun runs Nov. 14th to 29th, so wait."))).toEqual([]);
  });
  it("lets Esau name another animal's season or its hunters", () => {
    expect(checkReply(q({ species: "squirrel", weapon: "pellet" }), reply("Squirrel season pauses for deer gun season. Wear orange; deer hunters are out."))).toEqual([]);
  });
  it.each(SAMPLE_SPOTS.map((s) => [s.name, s] as const))("the offline read keeps every rule: %s", (_n, s) => {
    expect(checkReply(s.query, offlineRead(buildBrief(s.query)))).toEqual([]);
  });
});
