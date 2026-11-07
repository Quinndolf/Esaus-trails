import { describe, expect, it } from "vitest";
import { anchorMarks, markAnchors } from "../marks";
import type { EsauMark, SpotQuery } from "../types";

const spot = { lat: 36.75, lng: -85.7 };
const anchors = [
  { lat: 36.75, lng: -85.7 }, // tapped spot
  { lat: 36.752, lng: -85.701 }, // a nearby bench
];
const bounds = { west: -85.72, east: -85.68, south: 36.73, north: 36.77 };
const m = (kind: EsauMark["kind"], lat: number, lng: number): EsauMark => ({ kind, lat, lng, label: kind });

describe("anchorMarks", () => {
  it("snaps a pin that is a few yards off a real feature onto it", () => {
    const out = anchorMarks([m("bedding", 36.75201, -85.70102)], anchors, spot, bounds);
    expect(out).toEqual([{ kind: "bedding", lat: 36.752, lng: -85.701, label: "bedding" }]);
  });

  it("drops a bed, food, trail or stand pin that isn't near anything in the read", () => {
    const out = anchorMarks([m("bedding", 36.76, -85.69), m("stand", 36.745, -85.71)], anchors, spot, bounds);
    expect(out).toEqual([]);
  });

  it("keeps an approach or avoid pin on the read ground near the spot, as given", () => {
    const out = anchorMarks([m("approach", 36.748, -85.702)], anchors, spot, bounds);
    expect(out).toEqual([m("approach", 36.748, -85.702)]);
  });

  it("drops an approach pin off the read ground or far from the spot", () => {
    expect(anchorMarks([m("approach", 36.9, -85.7)], anchors, spot, bounds)).toEqual([]);
    expect(anchorMarks([m("avoid", 36.769, -85.719)], anchors, spot, bounds)).toEqual([]);
  });

  it("keeps a walk-in pin on the hunter's own position even when the hunter is far off", () => {
    const hunter = { lat: 36.76, lng: -85.69 }; // about 1,500 yd away
    const out = anchorMarks([m("approach", 36.76, -85.69)], [...anchors, hunter], spot, bounds);
    expect(out).toEqual([m("approach", 36.76, -85.69)]);
  });

  it("drops any pin off the hunter's screen, even one on a real place", () => {
    const view = { west: -85.7015, east: -85.699, south: 36.749, north: 36.7515 }; // the spot, not the bench
    const out = anchorMarks([m("bedding", 36.752, -85.701), m("stand", 36.75, -85.7), m("approach", 36.7495, -85.7005)], anchors, spot, bounds, view);
    expect(out.map((x) => x.kind)).toEqual(["stand", "approach"]);
  });

  it("drops pins with broken numbers", () => {
    expect(anchorMarks([m("bedding", NaN, -85.7)], anchors, spot, bounds)).toEqual([]);
  });
});

describe("markAnchors", () => {
  it("collects the spot, the hunter, nearby features and sit spots from the query and read", () => {
    const q = {
      spot,
      hunter: { lat: 36.74, lng: -85.71 },
      sitSpots: [{ rank: 1, lat: 36.751, lng: -85.699, watchBearingDeg: 0, yardsToTrail: 20, reason: "" }],
    } as unknown as SpotQuery;
    const got = markAnchors(q, [{ lat: 36.752, lng: -85.701 }]);
    expect(got).toEqual([
      { lat: 36.75, lng: -85.7 },
      { lat: 36.74, lng: -85.71 },
      { lat: 36.752, lng: -85.701 },
      { lat: 36.751, lng: -85.699 },
    ]);
  });
});

describe("field report", () => {
  it("tells Esau how wide a grid cell is", async () => {
    const { buildBrief } = await import("../brief");
    const { SAMPLE_SPOTS } = await import("../fixtures/spots");
    const q = SAMPLE_SPOTS[0]!.query;
    const b = buildBrief(q);
    expect(b.report).toMatch(/Grid: \d+ by \d+ cells, each about \d+ yd across/);
    expect(b.system).not.toMatch(/90 m elevation model/);
  });
  it("keeps Esau to the hunter's screen: says how big it is and lists only features on it", async () => {
    const { buildBrief } = await import("../brief");
    const { SAMPLE_SPOTS } = await import("../fixtures/spots");
    const q = SAMPLE_SPOTS[0]!.query;
    const all = buildBrief(q).spot.nearby;
    expect(all.length).toBeGreaterThan(0);
    const d = 0.002; // a small screen around the spot
    const view = { west: q.spot.lng - d, east: q.spot.lng + d, south: q.spot.lat - d, north: q.spot.lat + d };
    const b = buildBrief({ ...q, view });
    expect(b.report).toMatch(/SCREEN: the hunter's map shows about \d+ by \d+ yd/);
    expect(b.report).toMatch(/only about places on it/i);
    for (const f of b.spot.nearby) {
      expect(f.lat).toBeGreaterThanOrEqual(view.south);
      expect(f.lat).toBeLessThanOrEqual(view.north);
      expect(f.lng).toBeGreaterThanOrEqual(view.west);
      expect(f.lng).toBeLessThanOrEqual(view.east);
    }
    expect(buildBrief(q).report).not.toMatch(/SCREEN:/);
  });
});
