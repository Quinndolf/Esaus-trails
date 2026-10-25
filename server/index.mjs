// Small Node API that sits beside the static frontend (DigitalOcean droplet, behind HTTPS).
// Keeps secrets such as ANTHROPIC_API_KEY off the phone. Esau's endpoints land here in phase 4.
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT || 8787);

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true });
  send(res, 404, { error: 'not found' });
}).listen(PORT, () => console.log(`esau api on :${PORT}`));
