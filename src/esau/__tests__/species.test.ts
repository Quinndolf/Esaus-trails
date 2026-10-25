import { describe, expect, it } from "vitest";
import { buildBrief } from "../brief";
import { SAMPLE_SPOTS } from "../fixtures/spots";
import { offlineRead } from "../offline";
import { SPECIES, speciesBrain } from "../species";
import type { SpeciesId } from "../types";

const ids = SPECIES.map((s) => s.id);
const q = (species: SpeciesId, i = 0) => ({ ...SAMPLE_SPOTS[i]!.query, species });

describe("every species", () => {
  it("is ready, with its own knowledge, sources and phases", () => {
    for (const id of ids) {
      const b = speciesBrain(id)!;
      expect(b.ready).toBe(true);
      expect(b.knowledge.length).toBeGreaterThan(1500);
      expect(Object.keys(b.sources).length).toBeGreaterThanOrEqual(3);
      // Every [key] the knowledge cites is in its own source list.
      for (const [, key] of b.knowledge.matchAll(/\[(\w+)\]/g)) expect(b.sources).toHaveProperty(key!);
      for (const month of [0, 3, 6, 9, 11]) expect(b.phase(new Date(Date.UTC(2026, month, 15)), 40).id).toBeTruthy();
    }
  });

  it("keeps species apart: each prompt carries only its own animal's knowledge", () => {
    const heads = ["WHITETAIL DEER", "ELK (Cervus", "MULE DEER (Odocoileus", "BLACK BEAR (Ursus", "WILD TURKEY (Meleagris", "WILD HOG (feral"];
    for (const id of ids) {
      const sys = buildBrief(q(id)).system;
      expect(heads.filter((h) => sys.includes(h))).toHaveLength(1);
    }
  });

  it("gives every species a usable brief and offline read", () => {
    for (const id of ids)
      for (let i = 0; i < SAMPLE_SPOTS.length; i++) {
        const b = buildBrief(q(id, i));
        for (const v of Object.values(b.scores)) expect(v).toBeGreaterThanOrEqual(0);
        expect(offlineRead(b).say).toMatch(/^No signal/);
      }
  });
});

describe("species differences", () => {
  it("tells Esau a turkey can't smell the hunter, and doesn't warn about scent offline", () => {
    const b = buildBrief(q("turkey", 1)); // hunter upwind of the spot
    expect(b.report).toContain("doesn't hunt by nose");
    expect(offlineRead(b).say).not.toContain("anything there will smell you");
    expect(offlineRead(b).say).toContain("won't smell you");
  });
  it("still warns about scent for a bear in the same spot", () => {
    expect(offlineRead(buildBrief(q("black_bear", 1))).say).toContain("anything there will smell you");
  });
  it("puts each animal in its own season on the same day", () => {
    const at = new Date("2026-09-20T12:00:00Z");
    expect(speciesBrain("elk")!.phase(at, 44).id).toBe("rut");
    expect(speciesBrain("mule_deer")!.phase(at, 44).id).toBe("early season");
    expect(speciesBrain("black_bear")!.phase(at, 44).id).toBe("fall hyperphagia");
    expect(speciesBrain("turkey")!.phase(at, 44).id).toBe("fall flocks");
    expect(speciesBrain("whitetail")!.phase(at, 44).id).toBe("early season");
    expect(speciesBrain("turkey")!.phase(new Date("2026-04-28T12:00:00Z"), 37).id).toBe("spring: hens nesting");
  });
  it("calls a turkey's bed a roost", () => {
    expect(speciesBrain("turkey")!.words.bedding).toBe("roost");
  });
});
