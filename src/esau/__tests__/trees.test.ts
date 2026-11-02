import { describe, expect, it } from "vitest";
import { buildBrief } from "../brief";
import { SAMPLE_SPOTS } from "../fixtures/spots";
import { readSpot } from "../terrain";
import { hollowGrid, cell } from "../fixtures/hollow";
import { treeHint } from "../trees";
import { FOREST_GROUP } from "../../model/food";

describe("treeHint", () => {
  it("uses the USFS forest type when the grid has one", () => {
    const h = treeHint(41, 500)!;
    expect(h).toContain("likely");
    expect(h).toMatch(/oak/i);
    expect(h).not.toMatch(/\bis a\b/);
  });
  it("falls back to land cover, hedged", () => {
    expect(treeHint(41)).toMatch(/likely|often/);
    expect(treeHint(42)).toMatch(/pine|cedar/i);
    expect(treeHint(43)).toMatch(/mixed/i);
  });
  it("says nothing on a field, water or unknown cover", () => {
    for (const code of [0, 11, 81, 82, 71]) expect(treeHint(code)).toBeNull();
    expect(treeHint(82, 500)).toBeNull();
  });
  it("ignores a forest group that contradicts the cover class", () => {
    expect(treeHint(41, 160)).toBe(treeHint(41));
    expect(treeHint(42, 800)).toBe(treeHint(42));
    expect(treeHint(41, 100)).not.toMatch(/Pine ground/);
  });
  it("falls through to cover for groups with no hint", () => {
    for (const g of [700, 900, 999]) expect(treeHint(41, g)).toBe(treeHint(41));
  });
  it("hedges every forest-group hint", () => {
    for (const g of Object.values(FOREST_GROUP)) for (const c of [41, 42, 43]) {
      const h = treeHint(c, g)!;
      expect(h).toMatch(/likely|often|look for/i);
      expect(h).not.toMatch(/definitely|certainly|\bis a\b/i);
    }
  });
  it("never claims certainty", () => {
    for (const code of [41, 42, 43]) expect(treeHint(code)).not.toMatch(/\b(is|are) (a|an|the|oaks)\b|definitely|certainly/i);
  });
});

describe("trees in the spot read and brief", () => {
  it("adds a TREES line only where there are trees", () => {
    const g = hollowGrid();
    const wooded = readSpot(g, cell(16, 24));
    expect(wooded.cover.woody).toBe(true);
    const field = readSpot(g, cell(27, 24));
    expect(field.trees).toBeNull();
    expect(wooded.trees).not.toBeNull();
    const rep = buildBrief(SAMPLE_SPOTS[0]!.query).report;
    expect(rep.includes("TREES:")).toBe(Boolean(readSpot(SAMPLE_SPOTS[0]!.query.grid, SAMPLE_SPOTS[0]!.query.spot).trees));
  });
});

describe("forest type wiring and prompt caching", () => {
  it("reads the group into the spot when the grid carries one of matching length", () => {
    const g = hollowGrid();
    const spot = cell(16, 24);
    const withType = { ...g, forestType: g.cover.map(() => 500) };
    expect(readSpot(withType, spot).trees).toMatch(/Oak-hickory/);
    const short = { ...g, forestType: [500] };
    expect(readSpot(short, spot).trees).toBe(readSpot(g, spot).trees);
  });
  it("keeps TREES out of the cached system prompt", () => {
    const systems = new Set(SAMPLE_SPOTS.filter((s) => s.query.species === "whitetail").map((s) => buildBrief(s.query).system));
    expect(systems.size).toBe(1);
    expect([...systems][0]).not.toContain("TREES");
  });
});
