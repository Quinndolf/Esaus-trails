import { describe, expect, it } from "vitest";
import { buildBrief, EsauInputError } from "../brief";
import { readConditions } from "../conditions";
import { cell, hollowGrid } from "../fixtures/hollow";
import { SAMPLE_SPOTS } from "../fixtures/spots";
import { compass, sunPosition } from "../geo";
import { offlineRead } from "../offline";
import { whitetailPhase } from "../species/whitetail";
import { readSpot, terrainModel } from "../terrain";

const grid = hollowGrid();

describe("geo", () => {
  it("puts the sun high at noon and below the horizon at midnight in Kentucky", () => {
    expect(sunPosition(new Date("2026-11-08T18:00:00Z"), 37.69, -84.29).altitudeDeg).toBeGreaterThan(30);
    expect(sunPosition(new Date("2026-11-09T06:00:00Z"), 37.69, -84.29).altitudeDeg).toBeLessThan(-30);
  });
  it("names compass points", () => {
    expect(compass(315)).toBe("NW");
    expect(compass(359)).toBe("N");
  });
});

describe("terrain", () => {
  it("finds the saddle, the bench and the creek bottom", () => {
    expect(readSpot(grid, cell(6, 16)).landform).toBe("saddle");
    expect(readSpot(grid, cell(11, 24)).landform).toBe("bench");
    expect(readSpot(grid, cell(27, 5)).landform).toBe("creek bottom");
  });
  it("reads the main face as south-facing and the beans as food", () => {
    const s = readSpot(grid, cell(16, 24));
    expect(s.aspectName).toBe("south-facing");
    expect(s.slopeDeg).toBeGreaterThan(8);
    const field = readSpot(grid, cell(27, 24));
    expect(field.crop?.name).toBe("soybeans");
    expect(field.nearestFoodYd).toBe(0);
  });
  it("measures hunter-to-spot distance, bearing and climb", () => {
    const s = readSpot(grid, cell(11, 24), { hunter: cell(27, 24) });
    expect(s.fromHunter!.compass).toBe("N");
    expect(s.fromHunter!.yards).toBeGreaterThan(700);
    expect(s.fromHunter!.climbFt).toBeGreaterThan(300);
  });
  it("lists pins near the spot with their notes", () => {
    const s = readSpot(grid, cell(6, 16), { pins: [{ id: "a", kind: "sign", ...cell(7, 18), name: "Rub line", note: "fresh" }] });
    expect(s.nearby.find((f) => f.kind === "pin")?.label).toContain("Rub line");
  });
  it("caches the per-grid model", () => {
    expect(terrainModel(grid)).toBe(terrainModel(grid));
  });
});

describe("conditions", () => {
  it("has air sinking or pooling before sunrise", () => {
    const c = readConditions(grid, cell(16, 24), 0);
    expect(["sinking", "pooling"]).toContain(c.thermal.state);
    expect(c.scentTowardCompass).toBe("SE");
  });
  it("has the sun warming the south face by late morning", () => {
    expect(readConditions(grid, cell(16, 24), 5).thermal.state).toBe("rising");
  });
  it("lets strong wind wash the thermals out", () => {
    const windy = hollowGrid({ windMph: 18 });
    expect(readConditions(windy, cell(16, 24), 5).thermal.state).toBe("settled");
  });
  it("accepts a replacement thermal model", () => {
    expect(readConditions(grid, cell(16, 24), 5, { thermal: () => "pooling" }).thermal.state).toBe("pooling");
  });
});

describe("whitetail season", () => {
  const at = (iso: string) => whitetailPhase(new Date(iso), 38).id;
  it("walks the fall through the rut phases", () => {
    expect(at("2026-09-20T12:00:00Z")).toBe("early season");
    expect(at("2026-10-15T12:00:00Z")).toBe("october lull");
    expect(at("2026-11-01T12:00:00Z")).toBe("pre-rut");
    expect(at("2026-11-08T12:00:00Z")).toBe("seeking and chasing");
    expect(at("2026-11-15T12:00:00Z")).toBe("peak breeding");
    expect(at("2026-11-28T12:00:00Z")).toBe("post-rut");
    expect(at("2026-12-10T12:00:00Z")).toBe("second rut");
    expect(at("2027-01-10T12:00:00Z")).toBe("late season");
    expect(at("2027-05-20T12:00:00Z")).toBe("spring and fawning");
  });
  it("flags its rut date as a guess in the Deep South", () => {
    expect(whitetailPhase(new Date("2026-12-01T12:00:00Z"), 31).rutPeakConfident).toBe(false);
  });
  it("uses a state rut date when given one", () => {
    expect(whitetailPhase(new Date("2027-01-20T12:00:00Z"), 32, new Date("2027-01-18T00:00:00Z")).id).toBe("peak breeding");
  });
});

describe("brief", () => {
  it("covers position, terrain and air in every report", () => {
    for (const s of SAMPLE_SPOTS) {
      const b = buildBrief(s.query);
      expect(b.report).toContain("POSITION");
      expect(b.report).toContain("TERRAIN AT THE SPOT");
      expect(b.report).toContain("AIR");
    }
  });
  it("tells Esau when the hunter's scent is blowing at the spot", () => {
    const [down, up] = SAMPLE_SPOTS;
    expect(buildBrief(down!.query).report).toContain("is not blowing toward");
    expect(buildBrief(up!.query).report).toContain("is blowing toward the tapped spot");
  });
  it("keeps the system prompt identical across taps so it caches", () => {
    const systems = new Set(SAMPLE_SPOTS.filter((s) => s.query.species === "whitetail").map((s) => buildBrief(s.query).system));
    expect(systems.size).toBe(1);
    expect([...systems][0]).toContain("You are Esau");
    expect([...systems][0]).toContain("WHITETAIL DEER");
  });
  it("passes the hunter's question and history through", () => {
    const q = { ...SAMPLE_SPOTS[5]!.query, history: [{ role: "esau" as const, text: "That saddle's a crossing." }] };
    const r = buildBrief(q).report;
    expect(r).toContain("THE HUNTER ASKS: Where would you hang a stand");
    expect(r).toContain("Esau: That saddle's a crossing.");
  });
  it("refuses species Esau has not studied", () => {
    expect(() => buildBrief({ ...SAMPLE_SPOTS[0]!.query, species: "moose" as never })).toThrow(EsauInputError);
  });
  it("refuses a malformed grid", () => {
    expect(() => buildBrief({ ...SAMPLE_SPOTS[0]!.query, grid: { ...grid, elevationM: [1, 2] } })).toThrow(EsauInputError);
  });
});

describe("offline read", () => {
  it("gives a short, honest answer with no signal", () => {
    const r = offlineRead(buildBrief(SAMPLE_SPOTS[1]!.query));
    expect(r.more).toMatch(/^This is my short read/);
    expect(r.more).not.toMatch(/No signal/);
    expect(r.say).toContain("smell you");
    expect(r.confidence).toBe("low");
    expect(r.meta.servedBy).toBe("offline-rules");
  });
  it("teaches from the rules: sign to look for, the season phase, and the sun", () => {
    const b = buildBrief(SAMPLE_SPOTS[1]!.query);
    const r = offlineRead(b);
    expect(r.more).toContain(b.phase.notes.split(/(?<=[.!?])\s/)[0]);
    expect(r.more).toMatch(/Look for/);
  });
  it("keeps the spoken part to four sentences and never mentions photos", () => {
    for (const s of SAMPLE_SPOTS) {
      const r = offlineRead(buildBrief(s.query));
      expect(r.say.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(4);
      expect(`${r.say} ${r.more}`).not.toMatch(/photo/i);
    }
  });
  it("says when the season is closed or unconfirmed instead of staying quiet", () => {
    const base = buildBrief(SAMPLE_SPOTS[1]!.query);
    expect(offlineRead({ ...base, legal: { ...base.legal, status: "closed", note: "Deer season is closed." } }).more).toMatch(/closed.*KDFWR/);
    expect(offlineRead({ ...base, legal: { ...base.legal, status: "unknown" } }).more).toMatch(/can't confirm the season/);
  });
  it("leads with the legal heads-up and drops the hunt-it advice when closed", () => {
    const base = buildBrief(SAMPLE_SPOTS[1]!.query);
    const more = offlineRead({ ...base, legal: { ...base.legal, status: "closed", note: "Deer season is closed. Check the KDFWR guide." } }).more;
    expect(more.indexOf("Heads up")).toBeLessThan(more.indexOf("Look for"));
    expect(more).not.toContain(base.phase.notes.split(/(?<=[.!?])\s/)[0]!);
    expect((more.match(/KDFWR/g) ?? []).length).toBe(1);
  });
  it("does not cut phase notes at a.m., p.m. or U.S.", () => {
    const base = buildBrief(SAMPLE_SPOTS[1]!.query);
    const more = offlineRead({ ...base, phase: { ...base.phase, notes: "Be set by 6 a.m. near the U.S. highway. Then wait." } }).more;
    expect(more).toContain("Be set by 6 a.m. near the U.S. highway.");
    expect(more).not.toContain("Then wait.");
  });
  it("calls the bean field at noon open ground or feeding, not bedding", () => {
    expect(offlineRead(buildBrief(SAMPLE_SPOTS[4]!.query)).spotRole).not.toBe("bedding");
  });
});

