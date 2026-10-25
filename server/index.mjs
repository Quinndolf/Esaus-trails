// Small Node API that sits beside the static frontend (DigitalOcean droplet, behind HTTPS).
// Keeps secrets such as ANTHROPIC_API_KEY off the phone. Run with tsx so it can load the TypeScript in server/esau.
import { createServer } from 'node:http';
import { handleEsau } from './esau/route.ts';

const PORT = Number(process.env.PORT || 8787);

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, esau: Boolean(process.env.ANTHROPIC_API_KEY) });
  if (await handleEsau(req, res)) return;
  send(res, 404, { error: 'not found' });
}).listen(PORT, () => console.log(`esau api on :${PORT}`));
