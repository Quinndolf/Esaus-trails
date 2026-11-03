import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);

// server/vercel/health.ts
function handler(_req, res) {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, esau: Boolean(process.env.ANTHROPIC_API_KEY) }));
}
export {
  handler as default
};
