import { describe, expect, it } from "vitest";
import { buildBrief } from "../brief";
import { SAMPLE_SPOTS } from "../fixtures/spots";
import { readSpot } from "../terrain";
import { hollowGrid, cell } from "../fixtures/hollow";
import { treeHint } from "../trees";

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
  it("never claims certainty", () => {
    for (const code of [41, 42, 43]) expect(treeHint(code)).not.toMatch(/\b(is|are) (a|an|the|oaks)\b|definitely|certainly/i);
  });
});

describe("trees in the spot read and brief", () => {
  it("adds a TREES line only where there are trees", () => {
    const g = hollowGrid();
    const wooded = readSpot(g, cell(16, 24));
    const field = readSpot(g, cell(27, 24));
    expect(field.trees).toBeNull();
    if (wooded.cover.woody) expect(wooded.trees).not.toBeNull();
    const rep = buildBrief(SAMPLE_SPOTS[0]!.query).report;
    expect(rep.includes("TREES:")).toBe(Boolean(readSpot(SAMPLE_SPOTS[0]!.query.grid, SAMPLE_SPOTS[0]!.query.spot).trees));
  });
});
