// Usage: node scripts/smoke.mjs https://your-app.vercel.app
// Checks the deployed app answers. Needs no keys. Esau shows "false" until ANTHROPIC_API_KEY is set.
const base = (process.argv[2] || '').replace(/\/$/, '');
if (!/^https?:\/\//.test(base)) {
  console.error('Give the site address, e.g. node scripts/smoke.mjs https://your-app.vercel.app');
  process.exit(2);
}
const checks = [
  ['/api/health', 200, (t) => t.includes('"ok":true')],
  ['/api/ground?lat=36.75&lng=-85.7', 200, (t) => t.includes('elevation')],
  ['/', 200, (t) => t.includes('<div id="root"')],
  ['/api/nope', 404, () => true],
];
let bad = 0;
for (const [path, status, ok] of checks) {
  try {
    const r = await fetch(base + path, { signal: AbortSignal.timeout(30000) });
    const good = r.status === status && ok(await r.text());
    console.log(good ? 'ok  ' : 'FAIL', r.status, path);
    if (!good) bad++;
  } catch (e) {
    console.log('FAIL', path, String(e));
    bad++;
  }
}
process.exit(bad ? 1 : 0);
