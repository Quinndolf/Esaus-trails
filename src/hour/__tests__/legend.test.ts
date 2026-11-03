import { describe, expect, it, vi } from "vitest";
import { explainFeature, legendItems, pickExplainable, EXPLAINABLE_LAYERS } from "../legend";
import { hourScope } from "../scope";
import { ThermalState } from "../../model/types";
import { thermalRgba } from "../../home/shade";

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("map key", () => {
  it("names every deer layer: thermals, wind, trails, beds, where deer are, food, scent, sit spots", () => {
    const items = legendItems(hourScope("whitetail"), { food: true, thermals: true });
    expect(ids(items)).toEqual(["thermal-shade", "thermal-ticks", "wind", "trails", "beds", "presence", "food", "scent", "sit-spots"]);
    expect(items.find((i) => i.id === "trails")!.name).toMatch(/Yellow dashed/);
    expect(items.find((i) => i.id === "beds")!.name).toMatch(/Brown dots with a yellow rim/);
    expect(items.find((i) => i.id === "wind")!.name).toMatch(/White arrows/);
  });

  it("leaves out what isn't drawn: thermals off, food off", () => {
    const items = legendItems(hourScope("whitetail"), { food: false, thermals: false });
    expect(ids(items)).not.toContain("thermal-shade");
    expect(ids(items)).not.toContain("thermal-ticks");
    expect(ids(items)).not.toContain("food");
  });

  it("shows only that animal's layers: no deer trails or beds for squirrel", () => {
    const items = legendItems(hourScope("squirrel"), { food: true, thermals: true });
    expect(ids(items)).not.toContain("trails");
    expect(ids(items)).not.toContain("beds");
    expect(ids(items)).toContain("presence");
    expect(items.find((i) => i.id === "presence")!.name).toMatch(/squirrel/i);
  });

  it("is empty for ginseng or no animal", () => {
    expect(legendItems(hourScope("ginseng"), { food: true, thermals: true })).toEqual([]);
    expect(legendItems(null, { food: true, thermals: true })).toEqual([]);
  });

  it("describes the thermal shading with the colors actually painted", () => {
    const shade = legendItems(hourScope("whitetail"), { food: true, thermals: true })[0]!;
    const [r1, g1, b1] = thermalRgba(ThermalState.Rising, 1, 0);
    const [r2, g2, b2] = thermalRgba(ThermalState.Sinking, 1, 0);
    expect(shade.swatch).toEqual({ kind: "fill", colors: [`rgb(${r1},${g1},${b1})`, `rgb(${r2},${g2},${b2})`] });
    expect(shade.says).toMatch(/Light blue is warm air rising/);
    expect(shade.says).toMatch(/Dark red is cool air sinking/);
  });
});

describe("tap a mark", () => {
  it("explains a bed, saying whether deer are bedded now", () => {
    expect(explainFeature("hour-beds", { bedded: 0.9 })!.text).toMatch(/bedded here right now/);
    expect(explainFeature("hour-beds", { bedded: 0.1 })!.text).toMatch(/up and moving/);
  });

  it("explains a trail", () => {
    const e = explainFeature("hour-trails", { weight: 0.5 })!;
    expect(e.title).toBe("Likely trail");
    expect(e.text).toMatch(/don't walk on it/);
  });

  it("explains wind, with speed, and swirling wind", () => {
    expect(explainFeature("hour-wind", { mph: 7, eddy: false })!.text).toMatch(/about 7 mph/);
    expect(explainFeature("hour-wind", { mph: 7, eddy: true })!.title).toBe("Swirling wind");
  });

  it("explains each kind of thermal tick", () => {
    expect(explainFeature("hour-ticks", { state: ThermalState.Rising })!.text).toMatch(/rising uphill/);
    expect(explainFeature("hour-ticks", { state: ThermalState.Sinking })!.text).toMatch(/sinking downhill/);
    expect(explainFeature("hour-ticks", { state: ThermalState.Pooling })!.text).toMatch(/pooling/);
  });

  it("explains the scent cone and ignores unknown layers", () => {
    expect(explainFeature("hour-scent-fill", {})!.title).toBe("Your scent");
    expect(explainFeature("gps-dot", {})).toBeNull();
  });

  it("picks the most specific mark under a finger", () => {
    const map = {
      getLayer: (id: string) => EXPLAINABLE_LAYERS.includes(id as never),
      queryRenderedFeatures: vi.fn(() => [
        { layer: { id: "hour-wind" }, properties: { mph: 4, eddy: false } },
        { layer: { id: "hour-beds" }, properties: { bedded: 1 } },
      ]),
    };
    expect(pickExplainable(map, { x: 100, y: 50 })!.title).toBe("Likely bedding");
    expect(map.queryRenderedFeatures).toHaveBeenCalledWith([[90, 40], [110, 60]], { layers: [...EXPLAINABLE_LAYERS] });
  });

  it("returns null when nothing is under the tap or no layers exist yet", () => {
    expect(pickExplainable({ getLayer: () => true, queryRenderedFeatures: () => [] }, { x: 0, y: 0 })).toBeNull();
    const q = vi.fn(() => []);
    expect(pickExplainable({ getLayer: () => undefined, queryRenderedFeatures: q }, { x: 0, y: 0 })).toBeNull();
    expect(q).not.toHaveBeenCalled();
  });
});
