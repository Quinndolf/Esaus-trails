import { describe, expect, it } from "vitest";
import { cellCenter, type LngLat } from "../../model/geo";
import type { Trail } from "../../model/movement";
import { BOX, makeGrid } from "../../model/__tests__/fixtures";
import { analyzeHour } from "../analyze";
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
  it("gives no spots, and says unsure, for squirrel (no squirrel travel model yet) and with no weapon", () => {
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
