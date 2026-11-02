import { describe, expect, it } from "vitest";
import type { Analysis, Crossing } from "../analyze";
import { debriefLines } from "../debrief";

const base: Analysis = { distanceYd: 900, durationMin: 95, sits: [] };
const ctx = { species: "whitetail" as const, weapon: "bow" as const };
const cross: Crossing = { at: 0, lngLat: [-85.7, 36.75], what: "bed", yards: 120 };

describe("debriefLines", () => {
  it("names the bed, the yards and your scent for a crossing", () => {
    const l = debriefLines(base, ctx, [cross]).filter((x) => /bed/.test(x));
    expect(l).toHaveLength(1);
    expect(l[0]).toContain("120 yd");
    expect(l[0]).toContain("your scent");
  });
  it("says clean walk when nothing was crossed", () => {
    const l = debriefLines(base, ctx, []);
    expect(l.filter((x) => /clean walk/i.test(x))).toHaveLength(1);
  });
  it("mentions the longest sit in minutes", () => {
    const l = debriefLines({ ...base, sits: [{ lngLat: [0, 0], minutes: 42, start: 0 }] }, ctx, []);
    expect(l.join(" ")).toContain("42 minutes");
  });
  it("never mentions photos or notes", () => {
    const all = debriefLines({ ...base, sits: [{ lngLat: [0, 0], minutes: 20, start: 0 }] }, ctx, [cross, { ...cross, what: "trail" }]).join(" ");
    expect(all).not.toMatch(/photo|note/i);
  });
});
