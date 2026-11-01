// Small Node API that sits beside the static frontend (DigitalOcean droplet, behind HTTPS).
// Keeps secrets such as ANTHROPIC_API_KEY off the phone. Run with tsx so it can load the TypeScript in server/esau.
import { createServer } from 'node:http';
import { handleEsau } from './esau/route.ts';
import { handleGround } from './ground/route.ts';
import { handleNws } from './nws.ts';

const PORT = Number(process.env.PORT || 8787);
// The droplet sets HOST=127.0.0.1 so only nginx can reach the API; dev listens everywhere.
const HOST = process.env.HOST || undefined;

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, esau: Boolean(process.env.ANTHROPIC_API_KEY) });
  if (await handleNws(req, res)) return;
  if (await handleGround(req, res)) return;
  if (await handleEsau(req, res)) return;
  send(res, 404, { error: 'not found' });
}).listen(PORT, HOST, () => console.log(`esau api on ${HOST ?? '*'}:${PORT}`));
