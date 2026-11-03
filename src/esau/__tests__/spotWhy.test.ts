import { describe, expect, it } from "vitest";
import { spotWhy } from "../spotWhy";
import type { SitSpot } from "../../model/sitSpots";
import type { PointReading } from "../../model/conditions";

const spot = (o: Partial<SitSpot> = {}): SitSpot => ({
  rank: 1,
  lngLat: [-85.7, 36.75],
  watchBearingDeg: 0, // facing north, toward the trail
  score: 1,
  yardsToTrail: 25,
  reason: "Predicted trail 25 yd N; wind from the N carries your scent away from it.",
  ...o,
});

const reading = (o: { towardDeg?: number; driver?: string; state?: PointReading["thermal"]["state"] } = {}): PointReading => ({
  inGrid: true,
  elevationFt: 820,
  slopeDeg: 9,
  facing: 180,
  terrainWord: "sidehill bench",
  thermal: { state: o.state ?? "Settled", strength: 0.4, flowBearing: null, line: "Air is settled." },
  wind: { fromDeg: 0, mph: 6, sheltered: false, eddy: false, line: "Wind N 6 mph. Scent goes south." },
  scent: { towardDeg: o.towardDeg ?? 180, mph: 3, driver: o.driver ?? "wind", reachYards: 140, plume: null },
  summary: "",
  brief: "",
});

const text = (w: ReturnType<typeof spotWhy>, label: string) => w.lines.find((l) => l.label === label)?.text ?? "";

describe("spotWhy", () => {
  it("leads with Esau's own reason and names the spot", () => {
    const w = spotWhy(spot(), reading());
    expect(w.title).toBe("Why spot 1");
    expect(text(w, "Why here")).toContain("Predicted trail 25 yd");
  });

  it("says which way to face and how far to the trail", () => {
    expect(text(spotWhy(spot(), reading()), "Face")).toBe("Face north, toward the trail about 25 yd out.");
  });

  it("calls scent drifting away from where you face good", () => {
    const t = text(spotWhy(spot(), reading({ towardDeg: 180 })), "Wind and scent");
    expect(t).toContain("Wind N 6 mph.");
    expect(t).toContain("drifts south about 140 yd");
    expect(t).toMatch(/away from where you'll be watching/);
  });

  it("warns when scent drifts toward where you face this hour", () => {
    const t = text(spotWhy(spot(), reading({ towardDeg: 20 })), "Wind and scent");
    expect(t).toMatch(/toward where you'll be watching/);
    expect(t).toMatch(/weak this hour/);
    expect(t).not.toMatch(/away from where/);
  });

  it("does not claim a direction when scent swirls", () => {
    const t = text(spotWhy(spot(), reading({ driver: "swirling" })), "Wind and scent");
    expect(t).toMatch(/swirls/);
    expect(t).not.toMatch(/drifts/);
  });

  it("teaches what the air is doing", () => {
    expect(text(spotWhy(spot(), reading({ state: "Rising" })), "Air movement")).toMatch(/uphill/);
    expect(text(spotWhy(spot(), reading({ state: "Sinking" })), "Air movement")).toMatch(/downhill/);
    expect(text(spotWhy(spot(), reading({ state: "Pooling" })), "Air movement")).toMatch(/low ground/);
    expect(text(spotWhy(spot(), reading({ state: "Settled" })), "Air movement")).toMatch(/wind/);
  });

  it("describes the ground", () => {
    expect(text(spotWhy(spot(), reading()), "Ground")).toBe("Sidehill bench, 9° slope facing south, about 820 ft.");
  });

  it("says to walk in from behind so you never cross what you watch", () => {
    expect(text(spotWhy(spot(), reading()), "Walk in")).toMatch(/from the south/);
    expect(text(spotWhy(spot(), reading()), "Walk in")).toMatch(/never cross the trail/);
  });

  it("uses the right words for squirrel and turkey spots", () => {
    const sq = spotWhy(spot({ kind: "food_trees", reason: "Oak-hickory woods." }), reading());
    expect(text(sq, "Face")).toContain("toward the food trees");
    expect(text(sq, "Walk in")).toMatch(/slow and quiet/);
    const roost = spotWhy(spot({ kind: "roost", reason: "Likely roost ridge." }), reading());
    expect(text(roost, "Face")).toContain("toward the opening");
    expect(text(roost, "Walk in")).toMatch(/before light/);
    const strut = spotWhy(spot({ kind: "strut_zone", reason: "Likely strut zone." }), reading());
    expect(text(strut, "Face")).toContain("toward the open ground");
  });

  it("ranks against the best spot", () => {
    expect(text(spotWhy(spot(), reading()), "Rank")).toBe("Esau's strongest pick for this hour.");
    expect(text(spotWhy(spot({ rank: 3, score: 0.62 }), reading()), "Rank")).toBe("About 60% as strong as spot 1 this hour.");
  });

  it("still gives the pick reason when the spot is off the read ground, without inventing wind or terrain", () => {
    const w = spotWhy(spot(), null);
    expect(text(w, "Why here")).toContain("Predicted trail");
    expect(w.lines.map((l) => l.label)).not.toContain("Wind and scent");
    expect(w.lines.map((l) => l.label)).not.toContain("Ground");
    const off = spotWhy(spot(), { ...reading(), inGrid: false });
    expect(off.lines.map((l) => l.label)).not.toContain("Ground");
  });
});
