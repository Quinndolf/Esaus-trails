// Bundles the Vercel functions (server/vercel/*.ts) into plain single-file ES modules at api/*.js.
// Vercel's own per-file TypeScript step breaks on this repo's extensionless imports (500 on every
// function that imports anything), so we ship pre-bundled files. Run: npm run build:api
// Usage: node scripts/build-api.mjs [outdir]   (default: api)
import { build } from 'esbuild';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'server/vercel');
const out = resolve(process.argv[2] ?? join(root, 'api'));
mkdirSync(out, { recursive: true });
const entries = readdirSync(src).filter((f) => f.endsWith('.ts')).map((f) => join(src, f));
await build({
  entryPoints: entries,
  outdir: out,
  outExtension: { '.js': '.js' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  legalComments: 'none',
  logLevel: 'warning',
  // CommonJS dependencies (pngjs) call require() on Node built-ins; give the ES module one.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
console.log(`built ${entries.length} functions into ${out}`);
