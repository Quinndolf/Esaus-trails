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
  it("nws with no path is 404 too", async () => {
    expect((await fetch(`${base}/api/nws`)).status).toBe(404);
  });
});
