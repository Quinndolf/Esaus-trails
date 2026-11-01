import { describe, expect, it } from "vitest";
import { buildBrief } from "../../src/esau/brief";
import { SAMPLE_SPOTS } from "../../src/esau/fixtures/spots";

describe("sample spots (Kentucky, Nov 8, 2026)", () => {
  it.each(SAMPLE_SPOTS.map((s) => [s.name, s] as const))("%s: has a legal block, a weapon, and nothing private", (_n, s) => {
    const { report, legal } = buildBrief(s.query);
    expect(report).toContain("LEGAL (Kentucky");
    expect(["open", "closed", "unknown"]).toContain(legal.status);
    expect(report).toMatch(/TOP SIT SPOTS|not picked a weapon/);
    expect(Object.keys(s.query)).not.toContain("pins");
    expect(Object.keys(s.query)).not.toContain("photo");
  });
  it("calls a rifle out of season before Nov 14 and a pellet gun in season on squirrel", () => {
    const rifle = SAMPLE_SPOTS.find((s) => s.name.startsWith("Rifle"))!;
    const squirrel = SAMPLE_SPOTS.find((s) => s.name.startsWith("Squirrel"))!;
    expect(buildBrief(rifle.query).legal.status).toBe("closed");
    expect(buildBrief(squirrel.query).legal.status).toBe("open");
  });
});
