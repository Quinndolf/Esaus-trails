import type { IncomingMessage, ServerResponse } from "node:http";
import { buildGround, buildGroundBbox } from "./ground";

/**
 * GET /api/ground?lat=..&lng=..  GroundGrid around a point (Esau's tap).
 * GET /api/ground?west=..&south=..&east=..&north=..&cols=32&rows=32  GroundGrid over a box (the hour slider).
 */
export async function handleGround(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname !== "/api/ground") return false;
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.method !== "GET") {
    send(405, { error: "GET only" });
    return true;
  }
  const q = (k: string) => (url.searchParams.has(k) ? Number(url.searchParams.get(k)) : NaN);
  const [west, south, east, north] = ["west", "south", "east", "north"].map(q) as [number, number, number, number];
  const lat = q("lat"), lng = q("lng");
  const okLat = (v: number) => Number.isFinite(v) && Math.abs(v) <= 85;
  const okLng = (v: number) => Number.isFinite(v) && Math.abs(v) <= 180;
  try {
    if ([west, east].every(okLng) && [south, north].every(okLat)) {
      const cols = Math.round(q("cols") || 32), rows = Math.round(q("rows") || 32);
      // About 20 miles across and 64x64 cells is plenty, and keeps one request from fanning out into hundreds.
      if (!(west < east && south < north) || east - west > 0.4 || north - south > 0.3 || cols < 4 || rows < 4 || cols > 64 || rows > 64) {
        send(400, { error: "box too large or malformed (max 0.4 x 0.3 degrees, 64 x 64 cells)" });
        return true;
      }
      send(200, await buildGroundBbox({ west, south, east, north }, cols, rows));
    } else if (okLat(lat) && okLng(lng)) {
      send(200, await buildGround(lat, lng));
    } else {
      send(400, { error: "give lat and lng, or west, south, east and north" });
    }
  } catch (err) {
    console.error("ground:", err);
    send(502, { error: `Couldn't read the ground here: ${err instanceof Error ? err.message : "unknown error"}` });
  }
  return true;
}
