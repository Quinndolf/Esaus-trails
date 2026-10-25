#!/usr/bin/env node
// Downloads the photos listed in scripts/ginseng-photos.json into public/ginseng/photos/ and writes
// public/ginseng/photos/manifest.json, which the "How to harvest" slides read. A slide with a photo
// shows it first, with the credit underneath; the drawing stays one tap away.
//
//   npm run ginseng:photos
//
// "slide" is one of: legal, know, count, dig, seed, leave, sell. Add your own entries (your own
// photos, or ones whose license allows reuse: public domain, CC0, CC BY, CC BY-SA). Check each page.
// Use jpg, png or webp.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SLIDES = ['legal', 'know', 'count', 'dig', 'seed', 'leave', 'sell'];
const OK_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const sources = JSON.parse(await readFile(join(root, 'scripts/ginseng-photos.json'), 'utf8'));
const out = join(root, 'public/ginseng/photos');
await mkdir(out, { recursive: true });

const manifest = { photos: {} };
let failed = 0;
for (const s of sources) {
  const where = s.slide ?? '(no slide)';
  try {
    if (!SLIDES.includes(s.slide)) throw new Error(`slide must be one of ${SLIDES.join(', ')}`);
    for (const k of ['url', 'caption', 'author', 'license', 'source']) if (!s[k]) throw new Error(`missing "${k}"`);
    const ext = extname(new URL(s.url).pathname).toLowerCase();
    if (!OK_EXT.has(ext)) throw new Error(`url must end in ${[...OK_EXT].join(', ')} (got "${ext}")`);
    const res = await fetch(s.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const file = `${s.slide}${ext}`;
    await writeFile(join(out, file), Buffer.from(await res.arrayBuffer()));
    manifest.photos[s.slide] = { file, caption: s.caption, author: s.author, license: s.license, source: s.source };
    console.log(`ok   ${where} -> ${file}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${where}: ${err.message}`);
  }
}
await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`${Object.keys(manifest.photos).length} photos listed; slides without one show the drawing.`);
process.exit(failed ? 1 : 0);
