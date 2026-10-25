// Small Node API that sits beside the static frontend (DigitalOcean droplet, behind HTTPS).
// Keeps secrets such as ANTHROPIC_API_KEY off the phone. Run with tsx so it can load the TypeScript in server/esau.
import { createServer } from 'node:http';
import { handleEsau } from './esau/route.ts';
import { handleGround } from './ground/route.ts';

const PORT = Number(process.env.PORT || 8787);

// NWS asks every client for a User-Agent with contact info, which a browser can't set.
// The phone can call api.weather.gov directly, but going through here adds the header
// and shares one cached answer among everyone hunting the same 2.5 km grid cell.
const NWS = 'https://api.weather.gov';
const NWS_UA = process.env.NWS_USER_AGENT || "(esaus-trails, set NWS_USER_AGENT to 'app, contact@email')";
const NWS_TTL_MS = 10 * 60 * 1000;
const nwsCache = new Map();

async function proxyNws(res, path) {
  const hit = nwsCache.get(path);
  if (hit && Date.now() - hit.at < NWS_TTL_MS) return send(res, 200, hit.body);
  try {
    const upstream = await fetch(NWS + path, { headers: { 'user-agent': NWS_UA, accept: 'application/geo+json' } });
    const body = await upstream.json();
    if (upstream.ok) {
      if (nwsCache.size > 500) nwsCache.delete(nwsCache.keys().next().value);
      nwsCache.set(path, { at: Date.now(), body });
    }
    send(res, upstream.status, body);
  } catch (err) {
    send(res, 502, { error: 'nws unreachable', detail: String(err) });
  }
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, esau: Boolean(process.env.ANTHROPIC_API_KEY) });
  if (req.method === 'GET' && /^\/api\/nws\/(points|gridpoints|stations)\//.test(url.pathname)) {
    return proxyNws(res, url.pathname.slice('/api/nws'.length) + url.search);
  }
  if (await handleGround(req, res)) return;
  if (await handleEsau(req, res)) return;
  send(res, 404, { error: 'not found' });
}).listen(PORT, () => console.log(`esau api on :${PORT}`));
