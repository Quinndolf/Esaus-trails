import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { bboxAround, buildGround, cellCenters, clearGroundCache, coverFromPng, nlcdFromRgb, NLCD_COLORS } from "./ground";

function png(w: number, h: number, colorAt: (x: number, y: number) => [number, number, number, number]): Buffer {
  const img = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = colorAt(x, y);
      const i = (y * w + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a;
    }
  return PNG.sync.write(img);
}
const rgb = (code: number) => NLCD_COLORS.find(([c]) => c === code)![1];

describe("ground grid", () => {
  it("makes square-ish cells around the point", () => {
    const b = bboxAround(37.7, -84.3);
    expect(b.north - b.south).toBeCloseTo(0.018);
    expect(b.east - b.west).toBeGreaterThan(b.north - b.south);
    const pts = cellCenters(b);
    expect(pts).toHaveLength(1024);
    expect(pts[0]!.lat).toBeGreaterThan(pts[1023]!.lat);
    expect(pts[0]!.lng).toBeLessThan(pts[1023]!.lng);
  });

  it("decodes NLCD colours, tolerating slight blending", () => {
    const [r, g, b] = rgb(41);
    expect(nlcdFromRgb(r, g, b)).toBe(41);
    expect(nlcdFromRgb(r + 6, g - 5, b + 4)).toBe(41);
    expect(nlcdFromRgb(255, 0, 255)).toBe(0);
  });

  it("votes the majority class per cell and skips transparent pixels", () => {
    // West half deciduous, east half crops, one transparent cell corner.
    const img = png(128, 128, (x, y) => (x < 4 && y < 4 ? [0, 0, 0, 0] : [...(x < 64 ? rgb(41) : rgb(82)), 255] as [number, number, number, number]));
    const cover = coverFromPng(img);
    expect(cover[0]).toBe(0);
    expect(cover[1]).toBe(41);
    expect(cover[31]).toBe(82);
  });

  it("assembles elevation, cover and the next 24 forecast hours", async () => {
    clearGroundCache();
    const now = new Date("2026-11-08T12:30:00Z");
    const calls: string[] = [];
    const times = Array.from({ length: 72 }, (_, i) => new Date(Date.UTC(2026, 10, 8) + i * 36e5).toISOString().slice(0, 16));
    const fakeFetch = (async (input: string) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/v1/elevation")) {
        const n = new URL(url).searchParams.get("latitude")!.split(",").length;
        return new Response(JSON.stringify({ elevation: Array.from({ length: n }, (_, i) => 200 + i) }));
      }
      if (url.includes("mrlc.gov")) return new Response(new Uint8Array(png(128, 128, () => [...rgb(43), 255] as [number, number, number, number])), { headers: { "content-type": "image/png" } });
      if (url.includes("/v1/forecast"))
        return new Response(JSON.stringify({ hourly: { time: times, temperature_2m: times.map(() => 40), wind_speed_10m: times.map(() => 8), wind_direction_10m: times.map(() => 300), wind_gusts_10m: times.map(() => 14), pressure_msl: times.map(() => 1016) } }));
      return new Response("nope", { status: 404 });
    }) as typeof fetch;

    let forecasts = 0;
    const forecast = async () => {
      forecasts++;
      return { source: "nws", hours: Array.from({ length: 40 }, (_, i) => ({ at: new Date(Date.UTC(2026, 10, 8, 10) + i * 36e5).toISOString(), tempF: 40, windMph: 8, windFrom: 300, gustMph: 14, skyCoverPct: 20 })) };
    };
    const g = await buildGround(37.7, -84.3, { fetch: fakeFetch, now, forecast });
    expect(g.elevationM).toHaveLength(1024);
    expect(calls.filter((u) => u.includes("/v1/elevation"))).toHaveLength(11);
    expect(new Set(g.cover)).toEqual(new Set([43]));
    expect(g.weather.hours).toHaveLength(24);
    expect(g.weather.hours[0]!.at).toBe("2026-11-08T12:00:00.000Z");
    expect(g.weather.hours[0]!.windFrom).toBe(300);
    expect(g.weather.hours[0]!.skyCover).toBe(20);
    expect(g.weather.source).toBe("nws");

    // A nearby tap reuses cached terrain and weather.
    await buildGround(37.7004, -84.3004, { fetch: fakeFetch, now, forecast });
    expect(calls.filter((u) => u.includes("/v1/elevation"))).toHaveLength(11);
    expect(forecasts).toBe(2); // weather caching is getForecast's job
  });

  it("carries on without land cover, and says so", async () => {
    clearGroundCache();
    const times = Array.from({ length: 48 }, (_, i) => new Date(Date.UTC(2026, 10, 8) + i * 36e5).toISOString().slice(0, 16));
    const f = (async (input: string) => {
      const url = String(input);
      if (url.includes("/v1/elevation")) return new Response(JSON.stringify({ elevation: Array(new URL(url).searchParams.get("latitude")!.split(",").length).fill(300) }));
      if (url.includes("/v1/forecast")) return new Response(JSON.stringify({ hourly: { time: times, temperature_2m: times.map(() => 40), wind_speed_10m: times.map(() => 5), wind_direction_10m: times.map(() => 180) } }));
      return new Response("down", { status: 503 });
    }) as typeof fetch;
    const forecast = async () => ({ source: "open-meteo", stale: true, hours: times.map((t) => ({ at: `${t}:00.000Z`, tempF: 40, windMph: 5, windFrom: 180 })) });
    const g = await buildGround(38, -85, { fetch: f, now: new Date("2026-11-08T01:00:00Z"), forecast });
    expect(g.cover.every((c) => c === 0)).toBe(true);
    expect(g.notes!.join(" ")).toContain("Land cover unavailable");
    expect(g.notes!.join(" ")).toContain("older cached forecast");
  });
});
