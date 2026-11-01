import { describe, expect, it } from "vitest";
import { buildBrief } from "../brief";
import { cell, hollowGrid } from "../fixtures/hollow";

const grid = hollowGrid();
const base = { species: "whitetail" as const, spot: cell(6, 16), grid, hourIndex: 0, timeZone: "America/Chicago" };

describe("privacy: Esau never sees the hunter's marks or photos", () => {
  it("leaves marks and photo notes out of the field report", () => {
    const sneaky = {
      ...base,
      pins: [{ id: "p1", kind: "sign", ...cell(7, 18), name: "Secret rub line", note: "my private note" }],
      photo: { image: null, name: "Secret photo", notes: "my private photo note" },
    };
    const { report } = buildBrief(sneaky as never);
    for (const s of ["Secret rub line", "my private note", "Secret photo", "my private photo note", "PHOTO"]) {
      expect(report).not.toContain(s);
    }
  });
  it("exports no photo helper", async () => {
    const mod = (await import("../index")) as Record<string, unknown>;
    expect(mod.photoQuery).toBeUndefined();
  });
});
