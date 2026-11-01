import { describe, expect, it } from "vitest";
import type { Legal } from "../../rules/types";
import { safetyLines } from "../safety";

const open: Legal = { status: "open", note: "", seasonLabel: "modern gun season (Nov 14 to 29, 2026)" };
const base = { species: "whitetail" as const, weapon: "rifle" as const, legal: open, sunPhase: "morning", batteryPct: 80, saddle: false, alreadyShown: new Set<string>() };

describe("safety lines", () => {
  it("reminds about blaze orange in gun season", () => {
    expect(safetyLines(base).lines.join(" ")).toMatch(/blaze orange/i);
  });
  it("does not nag about orange for a bow", () => {
    expect(safetyLines({ ...base, weapon: "bow", legal: { ...open, seasonLabel: "archery season" } }).lines.join(" ")).not.toMatch(/orange/i);
  });
  it("mentions a flashlight at dawn, dusk and night only", () => {
    expect(safetyLines({ ...base, sunPhase: "dawn" }).lines.join(" ")).toMatch(/flashlight/i);
    expect(safetyLines({ ...base, sunPhase: "midday" }).lines.join(" ")).not.toMatch(/flashlight/i);
  });
  it("warns under 50 percent battery, not above, and not when the phone cannot say", () => {
    expect(safetyLines({ ...base, batteryPct: 40 }).lines.join(" ")).toMatch(/battery/i);
    expect(safetyLines({ ...base, batteryPct: 50 }).lines.join(" ")).not.toMatch(/battery/i);
    expect(safetyLines({ ...base, batteryPct: null }).lines.join(" ")).not.toMatch(/battery/i);
  });
  it("adds a harness line for a saddle setup", () => {
    expect(safetyLines({ ...base, saddle: true }).lines.join(" ")).toMatch(/harness|lineman/i);
  });
  it("says each thing once per hunt", () => {
    const first = safetyLines({ ...base, batteryPct: 30, saddle: true });
    expect(first.lines.length).toBeGreaterThan(0);
    const again = safetyLines({ ...base, batteryPct: 30, saddle: true, alreadyShown: new Set(first.shown) });
    expect(again.lines).toEqual([]);
  });
});
