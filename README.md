# Esau's Trails

A mobile-first hunting map in the style of onX Hunt, with Esau, an AI hunting companion who reads the ground around you using GPS, topography, wind and thermals.

The reference prototype ("Steve-O's Deer Trails", built in Grok App Builder) is being ported into this repo phase by phase.

## Stack

Vite, React 18, TypeScript, MapLibre GL JS 5. A small Node API in `server/` holds secrets and talks to Claude for Esau.

## Layout

| Path | What lives there |
|---|---|
| `src/map/` | Map, basemaps, GPS, compass, shared geo math |
| `src/layers/` | Layer folders, toggles, view options |
| `src/tools/` | Tools menu, waypoints, draw, measure, tracker |
| `src/offline/` | Offline tile saving |
| `src/esau/` | Esau panel and API client |
| `src/model/` | Terrain, species, wind and thermal model |
| `src/photos/` | Photo pins, EXIF, local photo storage |
| `src/calls/` | Press-and-hold deer and squirrel calls |
| `src/ginseng/` | Ginseng habitat likelihood, Kentucky rules, mode UI |
| `src/ui/` | Shared UI: bottom sheet, icons, buttons |
| `server/` | Node API (`/api/*`) |

## Run it

```sh
npm install
npm run dev     # frontend on :5173, proxies /api to :8787
npm run api     # Node API on :8787
npm test
npm run build   # static site in dist/
```

## Hosting

DigitalOcean droplet: the build is served by nginx and `server/index.mjs` runs as a systemd service behind the same HTTPS host at `/api`. Location and compass need HTTPS on phones. Copy-paste steps are in [deploy/README.md](deploy/README.md).

## Call recordings

The Calls sheet plays real recordings when they are listed in `public/calls/manifest.json`, and a
synthesized stand-in otherwise. To add recordings, copy `scripts/calls-sources.example.json` to
`scripts/calls-sources.json`, fill in one entry per call (direct mp3, wav or m4a URL, author, license, and the
page that shows the license), and run `npm run calls:fetch` on a machine that can reach the sources. Only use
public-domain or CC BY / CC BY-SA clips (check each page); the sheet shows the credit for every clip.

## Ginseng photos

The "How to harvest" slides show a real photo, with its credit, when one is listed in
`public/ginseng/photos/manifest.json`; otherwise the drawing. `scripts/ginseng-photos.json` already lists two
public-domain NPS photos of the plant (Wendy Cass, Shenandoah National Park). Run `npm run ginseng:photos` on a
machine that can reach the sources to download them. Add entries for the other steps (dig, seed, leave, sell, legal)
with your own photos or ones whose license allows reuse, and check each page's license.
