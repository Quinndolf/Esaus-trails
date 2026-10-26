#!/usr/bin/env node
// Downloads the call recordings listed in scripts/calls-sources.json into public/calls/ and writes
// public/calls/manifest.json, which the Calls sheet reads (it also shows each clip's credit).
//
//   cp scripts/calls-sources.example.json scripts/calls-sources.json   # then fill it in
//   npm run calls:fetch
//
// Only add clips whose license lets you use them: public domain (CC0, US government), or CC BY / CC BY-SA with the
// attribution shown in the app. Non-commercial (NC) clips are fine for a private beta, not for a paid app. Check each source page yourself. Use mp3, wav or m4a: Safari on
// iPhone does not decode ogg everywhere.
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const IDS = [
  'deer-grunt',
  'deer-bleat',
  'deer-snort-wheeze',
  'deer-rattle',
  'squirrel-bark',
  'squirrel-red-chatter',
  'squirrel-pine',
  'turkey-yelp',
  'turkey-hen-call',
  'turkey-cluck-purr',
  'turkey-putt',
  'turkey-gobble',
];
const OK_EXT = new Set(['.mp3', '.wav', '.m4a', '.aac']);

const sources = JSON.parse(await readFile(join(root, 'scripts/calls-sources.json'), 'utf8'));
const out = join(root, 'public/calls');
await mkdir(out, { recursive: true });

// Keep clips that were added by hand (e.g. Pixabay, which only serves downloads to a browser) and are not
// listed in the sources file, as long as their file is still there.
const manifest = { recordings: {} };
let old = {};
try {
  old = JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8')).recordings ?? {};
  const listed = new Set(sources.map((s) => s.id));
  for (const [id, rec] of Object.entries(old)) {
    if (listed.has(id) || !IDS.includes(id)) continue;
    try {
      await access(join(out, rec.file));
      manifest.recordings[id] = rec;
      console.log(`keep ${id} (added by hand)`);
    } catch {
      /* file gone: drop it */
    }
  }
} catch {
  /* no manifest yet */
}
let failed = 0;
for (const s of sources) {
  const where = s.id ?? '(no id)';
  try {
    if (!IDS.includes(s.id)) throw new Error(`id must be one of ${IDS.join(', ')}`);
    for (const k of ['url', 'author', 'license', 'source']) if (!s[k]) throw new Error(`missing "${k}"`);
    // Some hosts (SoundBible's grab.php) have no extension in the URL: say it with "ext": ".mp3".
    const ext = (s.ext ?? extname(new URL(s.url).pathname)).toLowerCase();
    if (!OK_EXT.has(ext)) throw new Error(`url must end in ${[...OK_EXT].join(', ')}, or set "ext" (got "${ext}")`);
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
      ...(s.gap != null ? { gap: s.gap } : {}),
    };
    console.log(`ok   ${where} -> ${file}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${where}: ${err.message}`);
    // Keep the copy downloaded earlier, if there is one.
    const prev = old[s.id];
    if (prev) {
      try {
        await access(join(out, prev.file));
        manifest.recordings[s.id] = prev;
        console.error(`     ${where}: kept the earlier download`);
      } catch {
        /* none */
      }
    }
  }
}
await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`${Object.keys(manifest.recordings).length} recordings listed; the rest stay disabled ("No recording yet") on the Calls sheet.`);
process.exit(failed ? 1 : 0);
