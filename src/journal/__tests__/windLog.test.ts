// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { logWind, samplesBetween, windAt, type WindSample } from "../windLog";

afterEach(() => localStorage.clear());
const s = (at: number, fromDeg = 270, mph = 5): WindSample => ({ at, fromDeg, mph });
const H = 3600e3;

describe("windLog", () => {
  it("keeps samples in time order and returns those inside a window", () => {
    logWind(s(3 * H));
    logWind(s(1 * H));
    logWind(s(2 * H));
    expect(samplesBetween(1 * H, 2 * H).map((x) => x.at)).toEqual([1 * H, 2 * H]);
  });
  it("caps the log and survives corrupt storage", () => {
    for (let i = 0; i < 400; i++) logWind(s(i * 1000));
    expect(JSON.parse(localStorage.getItem("esau-wind-log")!).length).toBeLessThanOrEqual(300);
    localStorage.setItem("esau-wind-log", "{oops");
    expect(samplesBetween(0, 1e12)).toEqual([]);
    expect(() => logWind(s(1))).not.toThrow();
  });
  it("ignores samples with bad numbers", () => {
    logWind({ at: NaN, fromDeg: 1, mph: 1 });
    logWind({ at: 1, fromDeg: NaN, mph: 1 });
    expect(samplesBetween(0, 1e12)).toEqual([]);
  });
  it("picks the nearest sample, but not one more than 2 hours away", () => {
    const list = [s(0, 90), s(4 * H, 180)];
    expect(windAt(list, 1 * H)?.fromDeg).toBe(90);
    expect(windAt(list, 3 * H)?.fromDeg).toBe(180);
    expect(windAt([s(0)], 5 * H)).toBeNull();
    expect(windAt([], 0)).toBeNull();
  });
});
