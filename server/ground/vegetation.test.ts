import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { CDL_COLORS, cdlFromRgb, cropsFromPng, exportSize, fetchGreenness, greennessFromPng } from "./vegetation";

function png(w: number, h: number, f: (x: number, y: number) => [number, number, number, number]): Buffer {
  const img = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) img.data.set(f(x, y), (y * w + x) * 4);
  return PNG.sync.write(img);
}

describe("vegetation from overhead data", () => {
  it("decodes CDL colours and ignores unknown ones", () => {
    const [, c] = CDL_COLORS.find(([k]) => k === 5)!;
    expect(cdlFromRgb(...c)).toBe(5);
    expect(cdlFromRgb(c[0] + 5, c[1] + 4, c[2])).toBe(5);
    expect(cdlFromRgb(10, 10, 255)).toBe(0);
  });

  it("votes the crop per cell", () => {
    const corn = CDL_COLORS.find(([k]) => k === 1)![1];
    const out = cropsFromPng(png(128, 128, (x) => (x < 64 ? [...corn, 255] : [0, 0, 0, 0])) as Buffer, 32);
    expect(out[0]).toBe(1);
    expect(out[31]).toBe(0);
  });

  it("computes NDVI from near-infrared and red", () => {
    // NIR 200, red 50 -> 0.6 ; NIR 100, red 100 -> 0
    const out = greennessFromPng(png(128, 128, (x) => (x < 64 ? [200, 50, 60, 255] : [100, 100, 100, 255])), 32);
    expect(out[0]).toBe(60);
    expect(out[31]).toBe(0);
  });

  it("asks NAIP for the near-infrared, red and green bands", async () => {
    let url = "";
    const f = (async (u: string) => {
      url = u;
      return new Response(png(8, 8, () => [200, 50, 60, 255]) as unknown as BodyInit, { headers: { "content-type": "image/png" } });
    }) as unknown as typeof fetch;
    const g = await fetchGreenness({ west: -85.5, south: 37.5, east: -85.49, north: 37.51 }, f, 2, 2);
    expect(url).toMatch(/bandIds=3,0,1/);
    expect(g).toHaveLength(4);
  });

  it("asks ArcGIS for pixels the shape of the box, because it widens the extent otherwise", async () => {
    const box = { west: -85.7, south: 36.69, east: -85.678, north: 36.708 }; // 1.2 : 1 in degrees, like a real tap
    const [w, h] = exportSize(box, 32);
    expect(w).toBe(128);
    expect(w / h).toBeCloseTo((box.east - box.west) / (box.north - box.south), 1);
    let url = "";
    const f = (async (u: string) => {
      url = u;
      return new Response(png(8, 8, () => [200, 50, 60, 255]) as unknown as BodyInit, { headers: { "content-type": "image/png" } });
    }) as unknown as typeof fetch;
    await fetchGreenness(box, f, 32, 32);
    expect(url).toContain(`size=${w},${h}`);
  });
});
