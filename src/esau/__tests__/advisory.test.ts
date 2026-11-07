import { describe, expect, it } from "vitest";
import type { Legal } from "../../rules/types";
import { advisories } from "../advisory";
import { stepYards } from "../../model/geo";

const sit: [number, number] = [-85.7, 36.75];
const open: Legal = { status: "open", note: "It is archery season." };
const targetEast = stepYards(sit, 90, 100); // a trail 100 yd east of the sit spot

describe("advisories", () => {
  it("shows a big Out of season banner when the rules say closed", () => {
    const a = advisories({ legal: { status: "closed", note: "Crossbow opens September 19." }, wind: { mph: 5, fromDeg: 270 }, sit: null, targets: [] });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kind: "out_of_season", title: "Out of season" });
    expect(a[0]!.detail).toContain("September 19");
  });
  it("shows nothing for unknown rules (Esau just says to check the guide)", () => {
    expect(advisories({ legal: { status: "unknown", note: "" }, wind: { mph: 5, fromDeg: 270 }, sit: null, targets: [] })).toEqual([]);
  });
  it("flags wrong wind when the wind carries scent from the sit spot onto a predicted trail", () => {
    // Wind from the west (270) blows toward the east, where the trail is.
    const a = advisories({ legal: open, wind: { mph: 8, fromDeg: 270 }, sit: { lngLat: sit }, targets: [{ lngLat: targetEast }] });
    expect(a.map((x) => x.kind)).toEqual(["wrong_wind"]);
  });
  it("does not flag a wind that carries scent away from the trail", () => {
    const a = advisories({ legal: open, wind: { mph: 8, fromDeg: 90 }, sit: { lngLat: sit }, targets: [{ lngLat: targetEast }] });
    expect(a).toEqual([]);
  });
  it("ignores a dead-calm wind, where thermals decide", () => {
    const a = advisories({ legal: open, wind: { mph: 1, fromDeg: 270 }, sit: { lngLat: sit }, targets: [{ lngLat: targetEast }] });
    expect(a).toEqual([]);
  });
  it("shows nothing about wind with no sit spot chosen", () => {
    expect(advisories({ legal: open, wind: { mph: 10, fromDeg: 270 }, sit: null, targets: [{ lngLat: targetEast }] })).toEqual([]);
  });
  it("puts out of season first when both apply", () => {
    const a = advisories({ legal: { status: "closed", note: "x" }, wind: { mph: 8, fromDeg: 270 }, sit: { lngLat: sit }, targets: [{ lngLat: targetEast }] });
    expect(a.map((x) => x.kind)).toEqual(["out_of_season", "wrong_wind"]);
  });

  it("warns ahead when the wind will turn onto the trail in the next few hours", () => {
    const a = advisories({
      legal: open,
      wind: { mph: 8, fromDeg: 90 }, // fine now: scent blows west, away from the trail
      sit: { lngLat: sit },
      targets: [{ lngLat: targetEast }],
      later: [
        { hoursAhead: 1, wind: { mph: 8, fromDeg: 80 } },
        { hoursAhead: 2, wind: { mph: 9, fromDeg: 270 } }, // turns west: scent onto the trail
        { hoursAhead: 3, wind: { mph: 9, fromDeg: 270 } },
      ],
    });
    expect(a.map((x) => x.kind)).toEqual(["wind_shift"]);
    expect(a[0]!.title).toMatch(/2 hours/);
    expect(a[0]!.detail).toMatch(/west/i);
  });
  it("says an hour, not 1 hours", () => {
    const a = advisories({ legal: open, wind: { mph: 8, fromDeg: 90 }, sit: { lngLat: sit }, targets: [{ lngLat: targetEast }], later: [{ hoursAhead: 1, wind: { mph: 8, fromDeg: 270 } }] });
    expect(a[0]!.title).toMatch(/an hour/);
  });
  it("gives no shift warning when the wind is already wrong, stays good, or goes calm", () => {
    const wrongNow = advisories({ legal: open, wind: { mph: 8, fromDeg: 270 }, sit: { lngLat: sit }, targets: [{ lngLat: targetEast }], later: [{ hoursAhead: 1, wind: { mph: 8, fromDeg: 270 } }] });
    expect(wrongNow.map((x) => x.kind)).toEqual(["wrong_wind"]);
    const steady = advisories({ legal: open, wind: { mph: 8, fromDeg: 90 }, sit: { lngLat: sit }, targets: [{ lngLat: targetEast }], later: [{ hoursAhead: 1, wind: { mph: 8, fromDeg: 100 } }] });
    expect(steady).toEqual([]);
    const calm = advisories({ legal: open, wind: { mph: 8, fromDeg: 90 }, sit: { lngLat: sit }, targets: [{ lngLat: targetEast }], later: [{ hoursAhead: 1, wind: { mph: 1, fromDeg: 270 } }] });
    expect(calm).toEqual([]);
  });
});
