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

DigitalOcean droplet: `dist/` served as static files, `server/index.mjs` behind the same HTTPS host at `/api`. Location and compass need HTTPS on phones.
