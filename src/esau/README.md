# src/esau

Esau's voice and brain. Pure TypeScript with no React, so the map, the tools and the photo pins can all call it.

## How a tap becomes an answer

1. The map has a `GroundGrid` for the view: the prototype's 32x32 payload (elevation, NLCD cover, CDL crops, 24 hours of weather).
2. `buildBrief(query)` reads the spot (`terrain.ts`: landform, slope, aspect, cover, nearest food, water and edges, nearby saddles, benches, points, draws and pins), reads the air (`conditions.ts`: wind, where scent carries, sun, thermal on that slope, next six hours), works out the season (`species/whitetail.ts`), and writes one plain-text field report.
3. `askEsau(query)` posts the query to `/api/esau`. The server (`server/esau/`) sends Claude the persona and species knowledge as a cached system prompt, plus the field report (and the photo, if any), and gets back structured JSON.
4. With no signal, or if the server can't reach Claude, `askEsau` returns `offlineRead(brief)`: a short rule-based read, marked `meta.servedBy = "offline-rules"`.

```ts
import { askEsau } from "./esau";

const reply = await askEsau({
  species: "whitetail",
  spot: { lat, lng },          // where they tapped
  hunter: { lat, lng },        // GPS fix, if known
  grid,                        // GroundGrid for the view
  hourIndex,                   // the hour slider
  pins, layersHere, question,  // all optional
});
// reply.say, reply.headline, reply.confidence, reply.spotRole,
// reply.marks (up to 4 lat/lng callouts to draw), reply.wouldChangeMyMind
```

Photo pins: `photoQuery(buildEsauPhotoInput(pin), { species, grid, hunter })` turns the photo module's `EsauPhotoInput` into a query; then call `askEsau` as above.

## Files

| File | What it does |
|---|---|
| `types.ts` | `GroundGrid`, `SpotQuery`, `EsauReply` and the readings |
| `terrain.ts` | Per-grid slope, aspect, relief, flow, landform; `readSpot()` |
| `conditions.ts` | Wind, scent, sun and thermals for an hour. `ThermalFn` is the seam the wind and thermal model plugs into |
| `species/` | One knowledge base per animal. Whitetail is done; the others are listed but not ready, so Esau won't blur species |
| `persona.ts` | Who Esau is and how he talks |
| `brief.ts` | The field report |
| `offline.ts` | The no-signal answer |
| `client.ts` | Browser call to `/api/esau` |
| `photo.ts` | Photo pin to query |
| `fixtures/` | A synthetic hollow and six sample spots for tests |

## Server

`server/esau/` holds the Claude call (`ask.ts`), the response schema and the `/api/esau` route. It needs `ANTHROPIC_API_KEY` in the server's environment or a `.env` file (see `.env.example`). Model `claude-opus-5-5`, effort `low` for taps and `medium` for questions and photos.

`npm run esau:spots` runs Esau over the sample spots and writes `esau-sample-spots.md`. Without a key, or with `-- --dry`, it writes the field reports only.

## On the map (`ui/`)

- `useEsauMap(map, shouldSkip)`: a tap on open map reads that spot; draws the tapped spot and Esau's marks.
- `EsauPanel`: the spot card with the species picker, the air for the chosen hour, Esau's read and an "ask" box. It sits low with no scrim so the map stays visible.
- `useEsau` (zustand): `tapSpot`, `askPhoto` (wired to the photo pin sheet's "Ask Esau"), `ask(question)`, and `setTime(date)` for the app's hour slider. Changing the hour doesn't spend a call; the card offers "Ask Esau about 9:00 AM".
- `groundFor(spot)`: fetches `/api/ground` and keeps the last six grids on the phone, so a spot already looked at still reads with no signal.

`server/ground/` builds the grid: Open-Meteo elevation (Copernicus 90 m), NLCD 2021 land cover from the MRLC WMS, and weather from `src/model/forecast` (NWS, then Open-Meteo). `GET /api/ground?lat=&lng=` or `?west=&south=&east=&north=&cols=&rows=`.
