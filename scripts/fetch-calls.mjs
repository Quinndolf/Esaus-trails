#!/usr/bin/env node
// Downloads the call recordings listed in scripts/calls-sources.json into public/calls/ and writes
// public/calls/manifest.json, which the Calls sheet reads (it also shows each clip's credit).
//
//   cp scripts/calls-sources.example.json scripts/calls-sources.json   # then fill it in
//   npm run calls:fetch
//
// Only add clips whose license lets you use them: public domain (CC0), or CC BY / CC BY-SA with the
// attribution shown in the app. Check each source page yourself. Use mp3, wav or m4a: Safari on
// iPhone does not decode ogg everywhere.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const IDS = [
  'deer-grunt',
  'deer-bleat',
  'deer-snort-wheeze',
  'deer-rattle',
  'squirrel-bark',
  'squirrel-distress',
  'squirrel-cutter',
];
const OK_EXT = new Set(['.mp3', '.wav', '.m4a', '.aac']);

const sources = JSON.parse(await readFile(join(root, 'scripts/calls-sources.json'), 'utf8'));
const out = join(root, 'public/calls');
await mkdir(out, { recursive: true });

const manifest = { recordings: {} };
let failed = 0;
for (const s of sources) {
  const where = s.id ?? '(no id)';
  try {
    if (!IDS.includes(s.id)) throw new Error(`id must be one of ${IDS.join(', ')}`);
    for (const k of ['url', 'author', 'license', 'source']) if (!s[k]) throw new Error(`missing "${k}"`);
    const ext = extname(new URL(s.url).pathname).toLowerCase();
    if (!OK_EXT.has(ext)) throw new Error(`url must end in ${[...OK_EXT].join(', ')} (got "${ext}")`);
    const res = await fetch(s.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const file = `${s.id}${ext}`;
    await writeFile(join(out, file), Buffer.from(await res.arrayBuffer()));
    manifest.recordings[s.id] = {
      file,
      author: s.author,
      license: s.license,
      source: s.source,
      ...(s.loopStart != null ? { loopStart: s.loopStart } : {}),
      ...(s.loopEnd != null ? { loopEnd: s.loopEnd } : {}),
    };
    console.log(`ok   ${where} -> ${file}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${where}: ${err.message}`);
  }
}
await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`${Object.keys(manifest.recordings).length} recordings listed; the rest use the synthesized stand-ins.`);
process.exit(failed ? 1 : 0);
