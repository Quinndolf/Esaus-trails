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
    const systems = new Set(SAMPLE_SPOTS.map((s) => buildBrief(s.query).system));
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
    expect(() => buildBrief({ ...SAMPLE_SPOTS[0]!.query, species: "elk" })).toThrow(EsauInputError);
  });
  it("refuses a malformed grid", () => {
    expect(() => buildBrief({ ...SAMPLE_SPOTS[0]!.query, grid: { ...grid, elevationM: [1, 2] } })).toThrow(EsauInputError);
  });
});

describe("offline read", () => {
  it("gives a short, honest answer with no signal", () => {
    const r = offlineRead(buildBrief(SAMPLE_SPOTS[1]!.query));
    expect(r.say).toMatch(/^No signal/);
    expect(r.say).toContain("smell you");
    expect(r.confidence).toBe("low");
    expect(r.meta.servedBy).toBe("offline-rules");
  });
  it("calls the bean field at noon open ground or feeding, not bedding", () => {
    expect(offlineRead(buildBrief(SAMPLE_SPOTS[4]!.query)).spotRole).not.toBe("bedding");
  });
});

describe("photo pins", () => {
  const input = {
    name: "Bench thicket",
    notes: "Beds flattened in the leaves",
    tags: ["bedding"],
    position: cell(11, 24),
    altitude: 250,
    takenAt: "2026-11-08T13:05:00Z",
    heading: 200,
    locationSource: "manual" as const,
    image: { mediaType: "image/jpeg" as const, base64: "AAAA" },
  };
  it("builds a query at the pin, at the hour the photo was taken", async () => {
    const { photoQuery } = await import("../photo");
    const q = photoQuery(input, { species: "whitetail", grid, timeZone: "America/Chicago" });
    expect(q.hourIndex).toBe(2);
    const r = buildBrief(q).report;
    expect(r).toContain("PHOTO");
    expect(r).toContain('named "Bench thicket"');
    expect(r).toContain("camera facing SSW");
    expect(r).toContain("placed this pin by hand");
  });
  it("tells Esau when the image could not be read", async () => {
    const { photoQuery } = await import("../photo");
    const q = photoQuery({ ...input, image: null }, { species: "whitetail", grid });
    expect(buildBrief(q).report).toContain("You cannot see it");
  });
});
