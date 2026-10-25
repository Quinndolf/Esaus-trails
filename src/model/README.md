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

## Bedding, trails and the hour slider

`movement.ts` ports the prototype's whitetail bedding score, travel-cost surface, bed picking
and Dijkstra food-to-bed trails, keeping its weights. On top of that, `whitetailActivity`
splits each hour into bedded, moving and feeding from sun height, wind and heat. `presence`
blends bedding, corridors and food by that split, so probable deer shift across the ground
as the slider moves. Hard wind also tucks beds into the lee.

The slider itself lives in `src/hour/`. `useHour` (zustand) holds the ground, both models and
the selected `date`; anything else that should follow the slider, Esau's panel included,
subscribes to `useHour`.

## Atmosphere (pressure, fronts, dew point, cloud, moon)

`atmosphere.ts` adds the weather beyond wind and temperature. `createConditionsModel(...).at(date).atmosphere`
carries it for the hour slider and Esau's field report.

- Pressure: Open-Meteo `surface_pressure` (hPa), fetched alongside NWS (NWS gridpoints have none) by `withPressure`
  in `forecast.ts`. Trend is the change over the last 3 hours, worded steady / rising / falling / rapidly.
  A station's pressure is not blended into the forecast hours: sources sit on different baselines.
- Front: a cold front is called when the wind veers 60° or more clockwise within about 6 hours while the temperature
  falls 4 °F or more. Reads forecast hours only, so it can miss one at the edge of the forecast.
- Dew point: NWS gridpoint dewpoint or Open-Meteo `dew_point_2m`. Humid air trims both daytime heating and night
  cooling a little (`mugginess`); air within 3 °F of its dew point with under 5 mph wind is called fog and pools
  cold air harder.
- Moon: mean-lunation phase and lit fraction, good to about half a day.
- `movementFactor` nudges how many deer are on their feet: up to about 1.15 on a rapidly falling barometer, 1.08
  ahead of a front, 1.06 behind one, and a few percent toward night on a bright moon. These are deliberately small.
  The studies behind them (see `src/esau/species/whitetail.ts`, WEATHER, PRESSURE, MOON AND CALLS) found time of day
  dominates and weather and moon effects are weak or inconsistent. Treat them as hunter lore, not findings.
