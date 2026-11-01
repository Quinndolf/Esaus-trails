import { describe, expect, it, vi } from "vitest";
import { PNG } from "pngjs";
import { bboxAround, buildGround, resetDepBreaker, cellCenters, clearGroundCache, coverFromPng, nlcdFromRgb, NLCD_COLORS } from "./ground";

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

  describe("elevation rate limits", () => {
    const times = Array.from({ length: 48 }, (_, i) => new Date(Date.UTC(2026, 10, 8) + i * 36e5).toISOString().slice(0, 16));
    const forecast = async () => ({ source: "nws", hours: times.map((t) => ({ at: `${t}:00.000Z`, tempF: 40, windMph: 5, windFrom: 180 })) });
    const now = new Date("2026-11-08T01:00:00Z");
    const nCoords = (url: string) => new URL(url).searchParams.get("latitude")?.split(",").length ?? new URL(url).searchParams.get("locations")!.split("|").length;
    const other = (url: string) => (url.includes("mrlc.gov") || url.includes("arcgis") || url.includes("usda") ? new Response("down", { status: 503 }) : new Response("nope", { status: 404 }));

    it("retries a 429 from the elevation API instead of failing the tap", async () => {
      clearGroundCache();
      let hits = 0;
      const f = (async (input: string) => {
        const url = String(input);
        if (url.includes("/v1/elevation")) {
          if (++hits <= 3) return new Response("limit", { status: 429, headers: { "retry-after": "0" } });
          return new Response(JSON.stringify({ elevation: Array(nCoords(url)).fill(250) }));
        }
        return other(url);
      }) as typeof fetch;
      const g = await buildGround(38, -85, { fetch: f, now, forecast, retryDelayMs: 0 });
      expect(g.elevationM.every((e) => e === 250)).toBe(true);
    });

    const geomOf = (init?: RequestInit) => JSON.parse(new URLSearchParams(String(init?.body)).get("geometry")!);
    const dep3 = (init: RequestInit | undefined, v: number | string | ((k: number) => number | string)) =>
      new Response(JSON.stringify({ samples: geomOf(init).points.map((_: unknown, k: number) => ({ locationId: k, value: String(typeof v === "function" ? v(k) : v) })) }));

    it("prefers USGS 3DEP (10 m) when it answers, and says so", async () => {
      clearGroundCache();
      const urls: string[] = [];
      const f = (async (input: string, init?: RequestInit) => {
        const url = String(input);
        urls.push(url);
        if (url.includes("3DEPElevation")) return dep3(init, 301.5);
        return other(url);
      }) as typeof fetch;
      resetDepBreaker();
      const g = await buildGround(37.1, -85.7, { fetch: f, now, forecast, retryDelayMs: 0 });
      expect(g.elevationM.every((e) => e === 301.5)).toBe(true);
      expect(g.notes!.join(" ")).toContain("3DEP");
      expect(urls.some((u) => u.includes("open-meteo.com/v1/elevation"))).toBe(false);
    });

    it("sends points as lng,lat, keyed back by locationId even if the reply is shuffled", async () => {
      clearGroundCache();
      resetDepBreaker();
      let first: number[] | null = null;
      const f = (async (input: string, init?: RequestInit) => {
        const url = String(input);
        if (!url.includes("3DEPElevation")) return other(url);
        const pts = geomOf(init).points as number[][];
        first ??= pts[0]!;
        const samples = pts.map((_, k) => ({ locationId: k, value: String(100 + k) })).reverse();
        return new Response(JSON.stringify({ samples }));
      }) as typeof fetch;
      const g = await buildGround(37.1, -85.7, { fetch: f, now, forecast, retryDelayMs: 0 });
      expect(first![0]).toBeLessThan(-80); // longitude first
      expect(first![1]).toBeGreaterThan(30);
      expect(g.elevationM[0]).toBe(100);
      expect(g.elevationM[5]).toBe(105);
    });

    for (const [name, reply] of [
      ["NoData", (init?: RequestInit) => dep3(init, "NoData")],
      ["a blank value", (init?: RequestInit) => dep3(init, "")],
      ["a fill value", (init?: RequestInit) => dep3(init, -9999)],
      ["a gap in one sample", (init?: RequestInit) => dep3(init, (k) => (k === 7 ? "NoData" : 250))],
    ] as const) {
      it(`falls back to the 90 m service on ${name}, and keeps that answer cached`, async () => {
        clearGroundCache();
        resetDepBreaker();
        let depCalls = 0;
        const f = (async (input: string, init?: RequestInit) => {
          const url = String(input);
          if (url.includes("3DEPElevation")) { depCalls++; return reply(init); }
          if (url.includes("/v1/elevation")) return new Response(JSON.stringify({ elevation: Array(nCoords(url)).fill(260) }));
          return other(url);
        }) as typeof fetch;
        const g = await buildGround(37.1, -85.7, { fetch: f, now, forecast, retryDelayMs: 0 });
        expect(g.elevationM.every((e) => e === 260)).toBe(true);
        expect(g.notes!.join(" ")).not.toContain("3DEP");
        const calls = depCalls;
        await buildGround(37.1, -85.7, { fetch: f, now, forecast, retryDelayMs: 0 });
        expect(depCalls).toBe(calls); // genuine no-data is cached, not re-asked
      });
    }

    it("when 3DEP is down, falls back, does not hammer it, and retries 3DEP after a minute", async () => {
      clearGroundCache();
      resetDepBreaker();
      vi.useFakeTimers({ toFake: ["Date"] });
      try {
        vi.setSystemTime(new Date("2026-11-08T01:00:00Z"));
        let depCalls = 0, meteoCalls = 0, depUp = false;
        const f = (async (input: string, init?: RequestInit) => {
          const url = String(input);
          if (url.includes("3DEPElevation")) {
            depCalls++;
            return depUp ? dep3(init, 301) : new Response("down", { status: 503 });
          }
          if (url.includes("/v1/elevation")) { meteoCalls++; return new Response(JSON.stringify({ elevation: Array(nCoords(url)).fill(260) })); }
          return other(url);
        }) as typeof fetch;
        const g = await buildGround(37.1, -85.7, { fetch: f, now, forecast, retryDelayMs: 0 });
        expect(g.elevationM.every((e) => e === 260)).toBe(true);
        expect(depCalls).toBeLessThanOrEqual(3); // one failed round, no retries
        await buildGround(37.1, -85.7, { fetch: f, now, forecast, retryDelayMs: 0 });
        expect(depCalls).toBeLessThanOrEqual(3);
        expect(meteoCalls).toBe(11); // the coarse answer was kept briefly, not refetched
        depUp = true;
        vi.setSystemTime(new Date("2026-11-08T01:01:30Z"));
        const again = await buildGround(37.1, -85.7, { fetch: f, now, forecast, retryDelayMs: 0 });
        expect(again.elevationM.every((e) => e === 301)).toBe(true); // 3DEP is back and wins
      } finally {
        vi.useRealTimers();
      }
    });

    it("falls back to a second elevation service when Open-Meteo keeps saying 429", async () => {
      clearGroundCache();
      const f = (async (input: string) => {
        const url = String(input);
        if (url.includes("open-meteo.com/v1/elevation")) return new Response("limit", { status: 429 });
        if (url.includes("opentopodata")) return new Response(JSON.stringify({ status: "OK", results: Array.from({ length: nCoords(url) }, () => ({ elevation: 310 })) }));
        return other(url);
      }) as typeof fetch;
      const g = await buildGround(38, -85, { fetch: f, now, forecast, retryDelayMs: 0 });
      expect(g.elevationM.every((e) => e === 310)).toBe(true);
      expect(g.notes!.join(" ")).toContain("Open Topo Data");
    });

    it("still reads the spot, flat and with a note, when every elevation source is down, and does not cache that", async () => {
      clearGroundCache();
      let up = false;
      const f = (async (input: string) => {
        const url = String(input);
        if (url.includes("/v1/elevation") && up) return new Response(JSON.stringify({ elevation: Array(nCoords(url)).fill(222) }));
        if (url.includes("/v1/elevation") || url.includes("opentopodata")) return new Response("limit", { status: 429 });
        return other(url);
      }) as typeof fetch;
      const g = await buildGround(38, -85, { fetch: f, now, forecast, retryDelayMs: 0 });
      expect(g.elevationM).toHaveLength(1024);
      expect(g.notes!.join(" ")).toContain("Elevation unavailable");
      up = true;
      const g2 = await buildGround(38, -85, { fetch: f, now, forecast, retryDelayMs: 0 });
      expect(g2.elevationM[0]).toBe(222);
    });

    it("shares one set of elevation calls between simultaneous taps on the same ground", async () => {
      clearGroundCache();
      let calls = 0;
      const f = (async (input: string) => {
        const url = String(input);
        if (url.includes("/v1/elevation")) { calls++; return new Response(JSON.stringify({ elevation: Array(nCoords(url)).fill(100) })); }
        return other(url);
      }) as typeof fetch;
      await Promise.all([1, 2, 3].map(() => buildGround(38, -85, { fetch: f, now, forecast, retryDelayMs: 0 })));
      expect(calls).toBe(11);
    });
  });
});
