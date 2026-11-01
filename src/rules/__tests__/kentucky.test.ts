import { describe, expect, it } from "vitest";
import { harvestSteps, legalToday, SQUIRREL_AIR_GUN_CALIBERS } from "../kentucky";

const day = (iso: string) => new Date(`${iso}T12:00:00`);

describe("Kentucky rules (2026-27, Monroe County, deer zone 2)", () => {
  it("opens bow deer on Sept 5, 2026, and not the day before", () => {
    expect(legalToday({ species: "whitetail", weapon: "bow", at: day("2026-09-05") }).status).toBe("open");
    expect(legalToday({ species: "whitetail", weapon: "bow", at: day("2026-09-04") }).status).toBe("closed");
  });
  it("opens crossbow deer on Sept 19, 2026, and closes it after Jan 18, 2027", () => {
    expect(legalToday({ species: "whitetail", weapon: "crossbow", at: day("2026-09-18") }).status).toBe("closed");
    expect(legalToday({ species: "whitetail", weapon: "crossbow", at: day("2026-09-19") }).status).toBe("open");
    expect(legalToday({ species: "whitetail", weapon: "crossbow", at: day("2027-01-18") }).status).toBe("open");
    expect(legalToday({ species: "whitetail", weapon: "crossbow", at: day("2027-01-19") }).status).toBe("closed");
  });
  it("says a crossbow is out of season for the general hunter in early archery, with the reason", () => {
    const r = legalToday({ species: "whitetail", weapon: "crossbow", at: day("2026-09-10") });
    expect(r.status).toBe("closed");
    expect(r.note).toMatch(/crossbow/i);
    expect(r.note).toMatch(/Sept(ember)? 19/);
  });
  it("opens rifle (modern gun) only Nov 14 to 29", () => {
    expect(legalToday({ species: "whitetail", weapon: "rifle", at: day("2026-11-14") }).status).toBe("open");
    expect(legalToday({ species: "whitetail", weapon: "rifle", at: day("2026-11-30") }).status).toBe("closed");
  });
  it("opens squirrel with a pellet gun in the fall season, pausing the first deer-gun weekend", () => {
    expect(legalToday({ species: "squirrel", weapon: "pellet", at: day("2026-11-01") }).status).toBe("open");
    expect(legalToday({ species: "squirrel", weapon: "pellet", at: day("2026-11-14") }).status).toBe("closed");
    expect(legalToday({ species: "squirrel", weapon: "pellet", at: day("2026-11-16") }).status).toBe("open");
    expect(legalToday({ species: "squirrel", weapon: "pellet", at: day("2027-03-01") }).status).toBe("closed");
  });
  it("lists the air gun calibers the guide allows", () => {
    expect(SQUIRREL_AIR_GUN_CALIBERS).toEqual([".177", ".20", ".22", ".25"]);
  });
  it("is unknown for an animal or weapon not in the table, never 'open'", () => {
    expect(legalToday({ species: "elk", weapon: "rifle", at: day("2026-11-01") }).status).toBe("unknown");
    expect(legalToday({ species: "whitetail", weapon: "pellet", at: day("2026-11-01") }).status).toBe("unknown");
    expect(legalToday({ species: "whitetail", weapon: null, at: day("2026-11-01") }).status).toBe("unknown");
  });
  it("is unknown once the table's season year has passed", () => {
    const r = legalToday({ species: "whitetail", weapon: "bow", at: day("2027-09-10") });
    expect(r.status).toBe("unknown");
    expect(r.note).toMatch(/check the KDFWR guide/i);
  });
  it("carries a source and a verified date on every answer it commits to", () => {
    const r = legalToday({ species: "whitetail", weapon: "bow", at: day("2026-10-01") });
    expect(r.source).toContain("fw.ky.gov");
    expect(r.verified).toBe("2026-11-01");
  });
  it("flags the archery end date as unconfirmed", () => {
    expect(legalToday({ species: "whitetail", weapon: "bow", at: day("2026-12-01") }).unconfirmed).toBe(true);
  });
  it("uses the ginseng rules for ginseng", () => {
    expect(legalToday({ species: "ginseng", weapon: null, at: day("2026-10-01") }).status).toBe("open");
    expect(legalToday({ species: "ginseng", weapon: null, at: day("2026-06-01") }).status).toBe("closed");
  });
  it("gives deer check-in steps with the Telecheck number, and none for squirrel", () => {
    const h = harvestSteps("whitetail")!;
    expect(h.phones.join(" ")).toContain("1-800-245-4263");
    expect(h.steps.join(" ")).toMatch(/midnight/i);
    expect(harvestSteps("squirrel")).toBeNull();
  });
});
