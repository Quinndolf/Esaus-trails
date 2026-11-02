import { describe, expect, it } from "vitest";
import { destination, type LngLat } from "../../map/geo";
import type { Track, TrackPoint } from "../../tools/types";
import { analyzeTrack, scentCrossings } from "../analyze";

const START: LngLat = [-85.7, 36.75];
const pt = (lngLat: LngLat, sec: number): TrackPoint => ({ lngLat, time: sec * 1000, altitude: null });
const track = (points: TrackPoint[]): Track => ({ id: "t", name: "t", points, startedAt: points[0]?.time ?? 0, endedAt: points.at(-1)?.time ?? 0, distance: 0 });

describe("analyzeTrack", () => {
  it("measures a straight 100 m walk as about 109 yd", () => {
    const pts = Array.from({ length: 11 }, (_, i) => pt(destination(START, 90, i * 10), i * 10));
    const a = analyzeTrack(track(pts));
    expect(a.distanceYd).toBeGreaterThan(107);
    expect(a.distanceYd).toBeLessThan(111);
    expect(a.durationMin).toBeCloseTo(100 / 60, 1);
    expect(a.sits).toEqual([]);
  });
  it("counts 6 minutes within 15 yd as a sit and 4 minutes as not", () => {
    const still = (min: number, base: number) => Array.from({ length: min + 1 }, (_, i) => pt(destination(START, 0, (i % 2) * 3), base + i * 60));
    expect(analyzeTrack(track(still(6, 0))).sits).toHaveLength(1);
    expect(analyzeTrack(track(still(6, 0))).sits[0]!.minutes).toBeGreaterThanOrEqual(6);
    expect(analyzeTrack(track(still(4, 0))).sits).toEqual([]);
  });
  it("ignores a 1 km GPS jump with a 1 s gap", () => {
    const a = analyzeTrack(track([pt(START, 0), pt(destination(START, 0, 1000), 1), pt(destination(START, 0, 10), 20)]));
    expect(a.distanceYd).toBeLessThan(40);
  });
  it("returns zeros for 0 or 1 point and missing times", () => {
    expect(analyzeTrack(track([])).distanceYd).toBe(0);
    expect(analyzeTrack(track([pt(START, 0)])).durationMin).toBe(0);
    const noTime = track([{ lngLat: START, time: NaN, altitude: null }, { lngLat: destination(START, 0, 50), time: NaN, altitude: null }]);
    expect(() => analyzeTrack(noTime)).not.toThrow();
    expect(analyzeTrack(noTime).sits).toEqual([]);
  });
});

describe("scentCrossings", () => {
  const bed = destination(START, 90, 100); // east of the hunter, ~109 yd
  const t = track([pt(START, 0), pt(destination(START, 0, 1), 60)]);
  it("flags scent blowing toward a bed within 150 yd", () => {
    // wind from the west (270) carries scent east toward the bed
    const c = scentCrossings(t, { windFromDeg: () => 270, beds: [bed], trails: [] });
    expect(c).toHaveLength(1);
    expect(c[0]!.what).toBe("bed");
    expect(c[0]!.yards).toBeGreaterThan(100);
  });
  it("flags nothing when the wind carries scent the other way", () => {
    expect(scentCrossings(t, { windFromDeg: () => 90, beds: [bed], trails: [] })).toEqual([]);
  });
  it("flags nothing when the wind reading is missing (NaN)", () => {
    expect(scentCrossings(t, { windFromDeg: () => NaN, beds: [bed], trails: [] })).toEqual([]);
  });
  it("flags nothing when the bed is past 150 yd", () => {
    expect(scentCrossings(t, { windFromDeg: () => 270, beds: [destination(START, 90, 300)], trails: [] })).toEqual([]);
  });
});
