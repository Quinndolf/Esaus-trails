import { describe, expect, it } from "vitest";
import { cellCenter, type LngLat } from "../../model/geo";
import type { Trail } from "../../model/movement";
import { BOX, makeGrid } from "../../model/__tests__/fixtures";
import { analyzeHour, toSitSpotQuery } from "../analyze";
import { buildBrief } from "../brief";
import { cell, hollowGrid } from "../fixtures/hollow";

const grid = makeGrid(() => 250);
const mid = (r: number, c: number): LngLat => cellCenter(grid, r * BOX.cols + c);
const trail: Trail = { coordinates: Array.from({ length: 24 }, (_, k) => mid(16, 4 + k)), weight: 1 };
const n = BOX.cols * BOX.rows;
const wind = (fromDeg: number, mph = 8) => ({ fromDeg: new Float32Array(n).fill(fromDeg), mph: new Float32Array(n).fill(mph), sheltered: new Uint8Array(n), eddy: new Uint8Array(n) });
const mv = { trails: [trail], beds: [] } as never;
const at = new Date("2026-11-05T12:00:00Z");
const base = { grid, movement: mv, species: "whitetail" as const, weapon: "bow" as const, at, sit: null, hunter: null };

describe("analyzeHour", () => {
  it("ranks sit spots for a deer hunter and carries the legal read", () => {
    const a = analyzeHour({ ...base, wind: wind(0) });
    expect(a.spots.length).toBeGreaterThan(0);
    expect(a.spots[0]!.rank).toBe(1);
    expect(a.legal.status).toBe("open");
    expect(a.advisories).toEqual([]);
  });
  it("raises a wrong-wind banner for a chosen sit spot that blows scent onto the trail", () => {
    const sit = mid(17, 16); // just south of the trail
    const a = analyzeHour({ ...base, wind: wind(180), sit }); // wind from the south carries scent north, onto the trail
    expect(a.advisories.map((x) => x.kind)).toContain("wrong_wind");
  });
  it("raises out-of-season for a crossbow before Sept 19 and still returns spots", () => {
    const a = analyzeHour({ ...base, wind: wind(0), weapon: "crossbow", at: new Date("2026-09-10T12:00:00Z") });
    expect(a.advisories[0]!.kind).toBe("out_of_season");
    expect(a.spots.length).toBeGreaterThan(0);
  });
  it("gives squirrel hunters food-tree stands when the ground has cover, and none when it does not", () => {
    const sq = { ...base, species: "squirrel" as const, weapon: "pellet" as const, wind: wind(0) };
    const hardwood = { ...grid, cover: new Array(n).fill(41) };
    const morning = new Date("2026-11-05T13:00:00Z");
    const a = analyzeHour({ ...sq, grid: hardwood, at: morning });
    expect(a.spots.length).toBeGreaterThan(0);
    expect(a.spots.every((s) => s.kind === "food_trees")).toBe(true);
    expect(toSitSpotQuery(a.spots[0]!).kind).toBe("food_trees");
    expect(analyzeHour({ ...sq, grid: { ...grid, cover: new Array(n).fill(81) }, at: morning })).toMatchObject({ spots: [], unsure: true });
  });
  it("gives turkey hunters roost ridges at dawn and strut zones later, and none in the dark", () => {
    const tk = { ...base, species: "turkey" as const, weapon: "shotgun" as const, wind: wind(0) };
    const ground = { ...grid, cover: Array.from({ length: n }, (_, i) => (i % BOX.cols < BOX.cols / 2 ? 41 : 81)) };
    const dawn = analyzeHour({ ...tk, grid: ground, at: new Date("2026-05-05T11:00:00Z") });
    expect(dawn.spots.length).toBeGreaterThan(0);
    expect(dawn.spots.every((s) => s.kind === "roost")).toBe(true);
    const morning = analyzeHour({ ...tk, grid: ground, at: new Date("2026-05-05T15:30:00Z") });
    expect(morning.spots.every((s) => s.kind === "strut_zone")).toBe(true);
    expect(toSitSpotQuery(morning.spots[0]!).kind).toBe("strut_zone");
    expect(morning.legal.status).toBe("open");
    expect(analyzeHour({ ...tk, grid: ground, at: new Date("2026-05-06T03:00:00Z") })).toMatchObject({ spots: [], unsure: true });
  });
  it("gives no spots, and says unsure, for squirrel without ground cover and with no weapon", () => {
    expect(analyzeHour({ ...base, wind: wind(0), species: "squirrel", weapon: "pellet" })).toMatchObject({ spots: [], unsure: true });
    expect(analyzeHour({ ...base, wind: wind(0), weapon: null })).toMatchObject({ spots: [], unsure: true });
  });
  it("is unsure when there are no trails", () => {
    expect(analyzeHour({ ...base, movement: { trails: [], beds: [] } as never, wind: wind(0) }).unsure).toBe(true);
  });
});

describe("field report: legal and sit spots", () => {
  const g = hollowGrid();
  const q = { species: "whitetail" as const, spot: cell(6, 16), grid: g, hourIndex: 0, timeZone: "America/Chicago" };
  const spots = [{ rank: 1, lat: 36.75, lng: -85.7, watchBearingDeg: 90, yardsToTrail: 22, reason: "Predicted trail 22 yd E." }];
  it("lists ranked spots and calls them predictions", () => {
    const r = buildBrief({ ...q, weapon: "bow", sitSpots: spots, sitUnsure: false }).report;
    expect(r).toContain("TOP SIT SPOTS");
    expect(r).toMatch(/predicted/i);
    expect(r).toContain("#1");
    expect(r).toContain("22 yd");
  });
  it("describes squirrel spots as food trees, not trails", () => {
    const sq = [{ rank: 1, lat: 36.75, lng: -85.7, watchBearingDeg: 90, yardsToTrail: 40, reason: "Hardwood cover on the slope.", kind: "food_trees" as const }];
    const r = buildBrief({ ...q, species: "squirrel", weapon: "pellet", sitSpots: sq, sitUnsure: false }).report;
    expect(r).toContain("Food trees 40 yd away");
    expect(r).not.toContain("Predicted trail");
    expect(r).toMatch(/nut trees/i);
  });
  it("describes turkey spots as roost ridges and strut zones and tells Esau to give no scent advice", () => {
    const tk = [
      { rank: 1, lat: 36.75, lng: -85.7, watchBearingDeg: 90, yardsToTrail: 60, reason: "Likely roost ridge.", kind: "roost" as const },
      { rank: 2, lat: 36.76, lng: -85.7, watchBearingDeg: 270, yardsToTrail: 80, reason: "Likely strut zone.", kind: "strut_zone" as const },
    ];
    const r = buildBrief({ ...q, species: "turkey", weapon: "shotgun", sitSpots: tk, sitUnsure: false }).report;
    expect(r).toContain("Likely roost ridge, opening 60 yd away");
    expect(r).toContain("Likely strut zone, woods 80 yd away");
    expect(r).not.toContain("Predicted trail");
    expect(r).toMatch(/no wind or scent advice/i);
  });
  it("tells Esau to invent nothing when the ground gave nothing", () => {
    const r = buildBrief({ ...q, weapon: "bow", sitSpots: [], sitUnsure: true }).report;
    expect(r).toMatch(/do not invent/i);
  });
  it("states the legal read, and says to check the guide when it doesn't know", () => {
    expect(buildBrief({ ...q, weapon: "bow" }).report).toContain("LEGAL");
    const noWeapon = buildBrief({ ...q }).report;
    expect(noWeapon).toMatch(/check the KDFWR guide/i);
  });
  it("tells Esau the banner is already up when it is out of season, and to keep advising", () => {
    const stale = { ...q, weapon: "crossbow" as const };
    const brief = buildBrief(stale); // hollow fixture dates are 2026-11-08, crossbow open
    expect(brief.legal.status).toBe("open");
  });
});

describe("answer cap on dates", () => {
  it("does not split after month abbreviations or U.S.", async () => {
    const { splitAnswer } = await import("../answer");
    const r = splitAnswer("Gun season opens Nov. 14 in the U.S. south. Sit tight. Watch the draw. Stay low. Last one.");
    expect(r.say).toContain("Nov. 14");
    expect(r.overflow).toBe("Last one.");
  });
});
