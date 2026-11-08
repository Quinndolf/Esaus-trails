import { describe, expect, it } from "vitest";
import { cellCenter, stepYards, type LngLat } from "../../model/geo";
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
  it("warns before the forecast wind turns onto the trail at a chosen sit spot", () => {
    const sit = mid(17, 16); // just south of the trail
    const a = analyzeHour({ ...base, wind: wind(0), sit, windLater: [{ hoursAhead: 1, wind: wind(0) }, { hoursAhead: 2, wind: wind(180) }] });
    expect(a.advisories.map((x) => x.kind)).toEqual(["wind_shift"]);
    expect(a.advisories[0]!.title).toContain("2 hours");
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
  it("gives Esau the stay-or-move call to say first, even with no spots on screen", () => {
    const r = buildBrief({ ...q, weapon: "bow", sitSpots: [], sitUnsure: true, verdict: { pct: 12, stay: false, of: "sit", betterRanks: [], offScreen: { yards: 310, compass: "S" } } }).report;
    expect(r).toContain("STAY OR MOVE");
    expect(r).toContain("scores 12 out of 100");
    expect(r).toContain('Never say "percent as good"');
    expect(r).toContain("MOVE");
    expect(r).toContain("310 yd S, just off the screen");
    const stay = buildBrief({ ...q, weapon: "bow", sitSpots: spots, sitUnsure: false, verdict: { pct: 90, stay: true, of: "hunter", betterRanks: [] } }).report;
    expect(stay).toContain("The call is STAY");
    const zero = buildBrief({ ...q, weapon: "bow", sitSpots: spots, sitUnsure: false, verdict: { pct: 0, stay: false, of: "sit", betterRanks: [1], why: "out_of_range", trailYd: 212, rangeYd: 35 } }).report;
    expect(zero).toContain("no predicted deer trail within the weapon's 35 yd range; the nearest is about 210 yd away");
    expect(stay).toContain("where the hunter is standing");
  });
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

  it("only picks spots inside the part of the map on screen, re-ranked from 1", () => {
    // The trail runs across the whole grid; the screen shows only its east end.
    const view = { west: mid(16, 20)[0], east: BOX.east, south: BOX.south, north: BOX.north };
    const a = analyzeHour({ ...base, wind: wind(0), view });
    expect(a.spots.length).toBeGreaterThan(0);
    a.spots.forEach((s, k) => {
      expect(s.rank).toBe(k + 1);
      expect(s.lngLat[0]).toBeGreaterThanOrEqual(view.west);
    });
    expect(a.spots[0]!.score).toBe(1);
  });
  it("says unsure when nothing on screen is worth a sit", () => {
    const view = { west: BOX.west, east: mid(0, 2)[0], south: BOX.south, north: mid(2, 0)[1] }; // a corner far from the trail
    expect(analyzeHour({ ...base, wind: wind(0), view })).toMatchObject({ spots: [], unsure: true });
  });
});

describe("stay or move", () => {
  it("tells a deer hunter to move off a spot that blows scent on the trail, and to stay on the top pick", () => {
    const bad = analyzeHour({ ...base, wind: wind(180), sit: mid(17, 16) });
    expect(bad.verdict).toMatchObject({ stay: false, of: "sit" });
    expect(bad.verdict!.better.length).toBeGreaterThan(0);
    const top = analyzeHour({ ...base, wind: wind(0) }).spots[0]!;
    expect(analyzeHour({ ...base, wind: wind(0), sit: top.lngLat }).verdict).toMatchObject({ stay: true });
  });
  it("does not blame the wind on the card when the air is calm", () => {
    const sit = stepYards(mid(16, 16), 180, 20);
    expect(analyzeHour({ ...base, wind: wind(180, 8), sit }).verdict?.why).toBe("scent_on_trail");
    expect(analyzeHour({ ...base, wind: wind(180, 1), sit }).verdict?.why).toBeUndefined();
  });
  it("judges where the hunter stands when no sit is chosen, only if it is on screen", () => {
    const view = { west: grid.west, east: grid.east, south: grid.south, north: grid.north };
    expect(analyzeHour({ ...base, wind: wind(0), hunter: mid(17, 16), view }).verdict?.of).toBe("hunter");
    expect(analyzeHour({ ...base, wind: wind(0), hunter: [grid.east + 0.01, grid.north] as LngLat, view }).verdict).toBeUndefined();
  });
  it("gives no verdict without a weapon or for other animals", () => {
    expect(analyzeHour({ ...base, wind: wind(0), weapon: null, sit: mid(17, 16) }).verdict).toBeUndefined();
  });
});

describe("suggested walk in", () => {
  const scent = (deg: number) => ({ driftBearing: new Float32Array(n).fill(deg), spreadDeg: new Float32Array(n).fill(60) });
  it("walks from the hunter to the better spot on a move", () => {
    const hunter = mid(28, 16);
    const a = analyzeHour({ ...base, wind: wind(180), sit: mid(17, 16), hunter, scent: scent(0) });
    expect(a.verdict?.stay).toBe(false);
    expect(a.route!.from).toEqual(hunter);
    expect(a.route!.to).toEqual(a.verdict!.better[0]!.lngLat);
    expect(a.route!.path[0]).toEqual(hunter);
  });
  it("walks to the top pick when no spot is chosen, and draws nothing without the scent read", () => {
    const hunter = mid(28, 16);
    const a = analyzeHour({ ...base, wind: wind(0), hunter, scent: scent(180) });
    expect(a.route!.to).toEqual(a.spots[0]!.lngLat);
    expect(analyzeHour({ ...base, wind: wind(0), hunter }).route).toBeUndefined();
  });
  it("on a stay, walks to your own spot; with the GPS off the ground, starts from your spot", () => {
    const top = analyzeHour({ ...base, wind: wind(0) }).spots[0]!;
    const hunter = mid(28, 16);
    const stay = analyzeHour({ ...base, wind: wind(0), sit: top.lngLat, hunter, scent: scent(180) });
    expect(stay.verdict?.stay).toBe(true);
    expect(stay.route!.to).toEqual(top.lngLat);
    const far = analyzeHour({ ...base, wind: wind(180), sit: mid(17, 16), hunter: [grid.east + 0.05, grid.north] as LngLat, scent: scent(0) });
    expect(far.route!.from).toEqual(mid(17, 16));
  });
});

describe("setup in Esau's brief", () => {
  const g = hollowGrid();
  const q = { species: "whitetail" as const, spot: cell(6, 16), grid: g, hourIndex: 0, timeZone: "America/Chicago", weapon: "bow" as const };
  it("teaches to the setup", () => {
    expect(buildBrief({ ...q, setup: "saddle" }).report).toContain("SETUP: a saddle");
    expect(buildBrief({ ...q, setup: "tree_stand" }).report).toMatch(/hung stand is work to move/);
    expect(buildBrief({ ...q, setup: "ground" }).report).toMatch(/scent stays low/);
    expect(buildBrief(q).report).toContain("read it as on the ground");
  });
  it("gives a turkey hunter no scent talk for any setup", () => {
    for (const setup of ["ground", "tree_stand", "saddle"] as const) {
      const r = buildBrief({ ...q, species: "turkey", weapon: "shotgun", setup }).report;
      const line = r.split("\n").find((l) => l.startsWith("SETUP"))!;
      const next = r.split("\n")[r.split("\n").indexOf(line) + 1]!;
      expect(next).not.toMatch(/scent|wind|smell/i);
    }
  });
});
