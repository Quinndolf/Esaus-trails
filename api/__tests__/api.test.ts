import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import health from "../health";
import esau from "../esau";
import ground from "../ground";
import nws from "../nws";

type H = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void;
const routes: Record<string, H> = { "/api/health": health, "/api/esau": esau, "/api/ground": ground, "/api/nws": nws };
let base = "";
const server = createServer((req, res) => {
  const p = new URL(req.url || "/", "http://x").pathname;
  void routes[p]?.(req, res);
});

beforeAll(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => void server.close());

describe("vercel function wrappers", () => {
  it("health reports Esau off without a key", async () => {
    const r = await fetch(`${base}/api/health`);
    expect(await r.json()).toEqual({ ok: true, esau: false });
  });
  it("esau answers 503 JSON without a key", async () => {
    const r = await fetch(`${base}/api/esau`, { method: "POST", body: JSON.stringify({ species: "whitetail", spot: { lat: 36.7, lng: -85.7 }, grid: {} }) });
    expect(r.status).toBe(503);
    expect(r.headers.get("content-type")).toContain("json");
  });
  it("ground with no query is a 400 JSON", async () => {
    const r = await fetch(`${base}/api/ground`);
    expect(r.status).toBe(400);
    expect(await r.json()).toHaveProperty("error");
  });
  it("nws refuses paths outside points, gridpoints and stations", async () => {
    const r = await fetch(`${base}/api/nws?path=/alerts/active`);
    expect(r.status).toBe(404);
  });
  it("nws refuses dot-segment and encoded tricks", async () => {
    for (const p of ["/points/../alerts/active", "/points/%2e%2e/alerts", "/points//x", "/points/a%2Fb"]) {
      expect((await fetch(`${base}/api/nws?path=${encodeURIComponent(p)}`)).status).toBe(404);
    }
  });
  it("nws with no path is 404 too", async () => {
    expect((await fetch(`${base}/api/nws`)).status).toBe(404);
  });
});

describe("handleNws forwarding", () => {
  it("forwards the path and extra query params to weather.gov", async () => {
    const { handleNws } = await import("../../server/nws");
    const seen: string[] = [];
    const f = (async (u: string) => (seen.push(u), new Response(JSON.stringify({ ok: 1 }), { status: 200 }))) as unknown as typeof fetch;
    const s = createServer((req, res) => void handleNws(req, res, f));
    await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
    const b = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    expect((await fetch(`${b}/api/nws?units=si&path=/gridpoints/X/1,2/forecast`)).status).toBe(200);
    expect((await fetch(`${b}/api/nws/points/36.75,-85.7`)).status).toBe(200);
    s.close();
    expect(seen[0]).toBe("https://api.weather.gov/gridpoints/X/1,2/forecast?units=si");
    expect(seen[1]).toBe("https://api.weather.gov/points/36.75,-85.7");
  });
});
