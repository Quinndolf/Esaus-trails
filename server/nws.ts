import type { IncomingMessage, ServerResponse } from "node:http";

// NWS asks every client for a User-Agent with contact info, which a browser can't set.
// Going through here adds the header and shares one cached answer per 2.5 km grid cell.
const NWS = "https://api.weather.gov";
const NWS_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; body: unknown }>();
const ALLOWED = /^\/(points|gridpoints|stations)\//;

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * GET /api/nws/<points|gridpoints|stations>/...  (droplet / dev)
 * GET /api/nws?path=/points/...                  (Vercel rewrite)
 * Returns true when it handled the request.
 */
export async function handleNws(req: IncomingMessage, res: ServerResponse, f: typeof fetch = fetch): Promise<boolean> {
  const url = new URL(req.url || "/", "http://localhost");
  const viaPath = url.pathname === "/api/nws";
  if (!viaPath && !url.pathname.startsWith("/api/nws/")) return false;
  if (req.method !== "GET") return send(res, 405, { error: "GET only" }), true;
  let path = viaPath ? url.searchParams.get("path") || "" : url.pathname.slice("/api/nws".length) + url.search;
  if (viaPath && path && !path.startsWith("/")) path = "/" + path;
  if (!ALLOWED.test(path)) return send(res, 404, { error: "not found" }), true;
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < NWS_TTL_MS) return send(res, 200, hit.body), true;
  try {
    const ua = process.env.NWS_USER_AGENT || "(esaus-trails, set NWS_USER_AGENT to 'app, contact@email')";
    const upstream = await f(NWS + path, { headers: { "user-agent": ua, accept: "application/geo+json" } });
    const body = await upstream.json();
    if (upstream.ok) {
      if (cache.size > 500) cache.delete(cache.keys().next().value as string);
      cache.set(path, { at: Date.now(), body });
    }
    send(res, upstream.status, body);
  } catch (err) {
    send(res, 502, { error: "nws unreachable", detail: String(err) });
  }
  return true;
}
