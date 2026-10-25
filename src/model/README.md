# src/model

Terrain, species, wind and thermal model ported from the prototype (phases 5-6).

This folder has the **wind, thermal and scent** part so far. It is plain TypeScript over an
elevation grid and a forecast: no DOM, no MapLibre, no React, so it can run on the page, in a
worker, or on the server for Esau. Species logic (bedding, trails) lands here in phase 5 and
reads these fields.

## Using it

```ts
import { createConditionsModel, getForecast, storageCache } from './model';

// 1. Weather for the spot. NWS first, Open-Meteo outside the US or when NWS is down,
//    then whatever is cached (marked stale) when there's no signal.
const forecast = await getForecast(lat, lon, { cache: storageCache(localStorage), nwsBase: '/api/nws' });

// 2. Ground. Same 32x32 grid the prototype's "Analyze this view" fetched; canopy is optional.
const model = createConditionsModel({ west, south, east, north, cols: 32, rows: 32, elevationM, canopyPct }, forecast);

// 3. The hour slider.
const hours = model.hours(24);            // Date[] starting this hour
const hc = model.at(hours[k]);            // memoized; scrubbing is free
hc.thermal.state / strength / flowBearing // per cell, for the thermal overlay
hc.wind.fromDeg / mph / eddy              // per cell, for the wind arrows
hc.scent.driftBearing / spreadDeg         // per cell, where scent goes
hc.summary                                // "Upslope thermals. Scent climbs sunlit faces."

// 4. A map tap.
const r = model.read([lng, lat], hours[k]);
r.scent.plume?.ring                       // GeoJSON-ready polygon of the scent cone
r.brief                                   // facts for Esau's prompt: ground, wind, thermal, scent
```

`checkApproach(terrain, hc.scent, hc.thermal, route, beds)` is the prototype's walk-in check,
now run on traced scent plumes.

## What changed from the prototype

| | Prototype | Now |
|---|---|---|
| Thermal states | 4-way switch per cell | Same 4 states and codes, driven by a heating-minus-cooling balance with a strength 0-1, ground speed and flow bearing |
| Morning flip | Instant at 6° sun | Lags sunrise ~1.75 h; hollows drain longest, sun-facing slopes flip first |
| Evening flip | At sunset | Starts ~2 h before sunset on faces the sun has left |
| Clouds | Ignored | Overcast weakens rising by day and draining by night |
| Canopy | Ignored for thermals | Heavy timber slows daytime heating and ground wind |
| Wind washout | Hard cut at 12 mph | Gradual 4-13 mph, gusts count |
| Wind | One forecast vector | Bent by ground: ridges faster, hollows slower, lee slopes sheltered and eddying, draws channel it |
| Scent | Wind and thermal checked separately | Added as vectors; flags swirl where they fight; traced plume follows the drift field |
| Weather | NWS via closed server fn, 24 h | NWS gridpoints direct (degrees, gusts, sky cover) + latest station obs to correct "now", Open-Meteo fallback, offline cache |
| Time zone | Hard-coded America/Chicago | All UTC; NWS returns the point's zone for display |

## Weather proxy

`server/index.mjs` forwards `/api/nws/points|gridpoints|stations/...` to api.weather.gov with a
User-Agent (set `NWS_USER_AGENT="esaus-trails, you@example.com"`) and a 10-minute shared cache.
The client also works without it; leave `nwsBase` unset to call NWS directly.

## Tests

`npm test` runs the model suite on synthetic ground (a south face, a hollow, a ridge) for a
Kentucky day in late October.
