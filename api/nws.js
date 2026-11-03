import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);

// server/nws.ts
var NWS = "https://api.weather.gov";
var NWS_TTL_MS = 10 * 60 * 1e3;
var cache = /* @__PURE__ */ new Map();
var ALLOWED = /^\/(points|gridpoints|stations)\//;
function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}
async function handleNws(req, res, f = fetch) {
  const url = new URL(req.url || "/", "http://localhost");
  const viaPath = url.pathname === "/api/nws";
  if (!viaPath && !url.pathname.startsWith("/api/nws/")) return false;
  if (req.method !== "GET") return send(res, 405, { error: "GET only" }), true;
  let path;
  if (viaPath) {
    const rest = new URLSearchParams(url.searchParams);
    path = rest.get("path") || "";
    rest.delete("path");
    if (path && !path.startsWith("/")) path = "/" + path;
    const q = rest.toString();
    if (q) path += (path.includes("?") ? "&" : "?") + q;
  } else {
    path = url.pathname.slice("/api/nws".length) + url.search;
  }
  if (!ALLOWED.test(path) || /\.\.|\/\/|\\|%2e|%2f|%5c/i.test(path.split("?")[0])) return send(res, 404, { error: "not found" }), true;
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < NWS_TTL_MS) return send(res, 200, hit.body), true;
  try {
    const ua = process.env.NWS_USER_AGENT || "(esaus-trails, set NWS_USER_AGENT to 'app, contact@email')";
    const upstream = await f(NWS + path, { headers: { "user-agent": ua, accept: "application/geo+json" } });
    const body = await upstream.json();
    if (upstream.ok) {
      if (cache.size > 500) cache.delete(cache.keys().next().value);
      cache.set(path, { at: Date.now(), body });
    }
    send(res, upstream.status, body);
  } catch (err) {
    send(res, 502, { error: "nws unreachable", detail: String(err) });
  }
  return true;
}

// server/vercel/nws.ts
async function handler(req, res) {
  if (!await handleNws(req, res)) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  }
}
export {
  handler as default
};
