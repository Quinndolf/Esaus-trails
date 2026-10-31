# Esau teaches, and a cleaner map: design

Date: 2026-10-31. Requested by Quinn. Status: awaiting Quinn's review.

## Agreed understanding
- Esau teaches an **inexperienced hunter**. He explains why, in plain words, and never assumes the hunter knows terms like "thermals" or "bench".
- He must weigh species, season and rut phase, Kentucky law, the area, wind, thermals, slope and aspect, and the sun.
- The existing code is **extended, not rebuilt** (species picker, per-species knowledge, season phases, wind/thermal/scent model, sun-on-slope, hour slider, photos all stay).
- The interface gets **cleaner and crisper: more map, fewer buttons**.

## Part A: Esau's brain

### A1. Kentucky rules table (`src/rules/`)
Data file of KDFWR seasons, bag limits, weapon rules and legal shooting hours per species, each entry with `source` and `verified` date. Legal hours are computed from sun position (30 min before sunrise to 30 min after sunset for most species; table holds exceptions). Esau's field report gets a "LEGAL TODAY" block: what is in season, which weapon, legal light left. Esau states only what is in the block, says "check the current KDFWR guide" once, and says he doesn't know when the block is empty or stale (older than the current season year).
Tests: legal-hours edge cases (DST, sunrise day), out-of-season, missing species.

### A2. Source library (`src/esau/library/`)
One markdown or TS file per species of vetted notes. Each note is tagged with a shelf: `study`, `agency`, `field`, `tradition`, and carries a citation key. Existing `WHITETAIL_SOURCES` style keys carry over. Build-time check: every `[key]` used in knowledge text exists in sources (a test already shaped like this can be extended). Tribal tradition notes only from published, attributed ethnography; no invented stories.

### A3. Teaching layer (persona + reply format)
- Persona rewrite: a patient old hunter teaching a newcomer. Defines every term once in plain words ("thermals: warm air drifting uphill in the morning, cold air sliding down at night").
- Reply schema adds `lesson` (one reusable rule of thumb the hunter can use at the next spot) and optional `askBack` (one question, e.g. "How's the acorn crop this year?").
- Two modes: **Quick Read** (default, 3 to 6 sentences, plus the lesson) and **Teach me** (a short lesson tied to this exact spot: why here, why this wind, what to look for on the ground, what to do first). Reasoning order for every answer: law and safety, scent (wind and thermal), terrain, animal behavior, then the lesson.
- Safety and ethics as a standing duty for a beginner: know your target and what's beyond it, tell someone where you're going, no shots Esau can't justify. Brief, not preachy.
Tests: schema validation, offline fallback also produces a lesson, persona never mentions other species.

### A4. Quality check (`npm run esau:eval`)
Fixed set of test spots and beginner questions; each answer is checked by rules (cites only known sources, mentions wind when scent is the issue, includes a lesson, states legal block correctly, correct species only) and written to a transcript for Quinn to read. Extends the existing `esau:spots` script.

### A5. Weapon-aware coaching (rifle or bow)
The hunter picks a weapon (rifle, bow, crossbow, muzzleloader, shotgun) next to the animal. It travels with every Esau request and changes the advice:
- **Range and setup:** a bow hunter is taught to get inside about 20 to 30 yards (stand or blind on the trail, downwind approach); a rifle hunter is taught to find a shooting lane and a safe backstop at longer range.
- **Law:** the rules table is keyed by species and weapon (season dates, legal hours, legal equipment).
- **Wind and thermals** matter more the closer the shot, so bow answers lean harder on scent and approach.
- Esau names the backstop and what is beyond the target for every rifle setup.

### A6. Find the trail, find the animal (every mode)
Each species file gets a "how a beginner finds it" section Esau teaches from, in order: read the map for where it travels (saddles, benches, draw heads, field edges), walk to confirm with sign, pick a setup spot, plan the wind and the way in and out.
- **Deer, turkey, squirrel:** uses the existing food, bed and trail prediction (owned by the deer-prediction thread) as the starting point; Esau teaches what to look for on the ground to confirm it (tracks, droppings, rubs and scrapes, scratchings, cuttings, dusting spots).
- **Ginseng:** teaches the plant, the legal digging season and rules, and the habitat to search (north and east facing slopes, rich hardwood).
- Every answer ends the same way: where to go first, what to look for when you get there, and the one rule of thumb.

## Part B: Cleaner interface
Today the map screen carries 8 buttons plus pills: Layers, Hours, Tools, Call, Basemap, Compass, Locate, (Offline hidden), the animal pill, GPS pill and accuracy readout.

Proposed (3 buttons plus one chip):
- **Top-left chip**: the animal ("Whitetail"). Tap to switch species. The chip shows the chosen hour beside it.
- **Hour slider bar, always on screen** (Quinn's request): a thin bar above the Tools button, always visible once an animal is chosen, never hidden behind a button. Dragging it moves the whole app to that hour: the movement overlay, Esau's read, and a live strip above the bar showing that hour's wind arrow and speed, temperature, and thermal state (rising, sinking, settled, pooling). The bar itself is tinted by thermal state across the day and marks sunrise, sunset and legal shooting light, so a beginner sees at a glance when air rises, when it sinks, and when it is legal to shoot. It reuses the existing hour store and thermal model. The bar is slim (about 40 px tall when idle) and see-through (about 55% opaque, blurred behind), growing to the full readout line only while the finger is on it.
- **Animal chip dropdown**: a small list under the chip (eight animals, current one highlighted) with a Weapon row (rifle, bow, crossbow, muzzleloader). Replaces the full-screen picker.
- **Read this area**: there is no analyze button today; the app reads the ground (about 1.6 by 1.5 miles) automatically around the hunter when an animal is picked. When the hunter pans away, a small "Read this area" pill appears at the top and re-reads the ground where the map is centered; otherwise it stays hidden. Tapping any spot still gives Esau's read of that spot.
- **Right, one stack of two**: **Layers** (basemap choice moves inside the Layers sheet as a row at the top) and **My location**. Tapping My location centers; tapping again turns on the compass cone and bearing. No separate compass button.
- **Bottom center**: **Tools** (Swiss-army icon). Calls, photos, saved, mark my location, measure, draw, tracker all live in it. The Call button goes inside Tools.
- Status (GPS accuracy, elevation, "finding you") shows only as a thin line when something is wrong, and in the spot sheet otherwise.
- Esau's sheet: one drag-up card with Quick Read first and a "Teach me" button. Map stays visible above it.
- Visual: one corner radius, one shadow, white at 90% opacity, no text labels on buttons (icons plus accessible names), 44 px touch targets, same spacing everywhere.
Result: from 8 buttons to 3 plus a chip; the map shows roughly the whole screen when nothing is open.

Tests: existing UI tests updated; a screenshot test at phone size for the idle screen; check every removed control is reachable (Basemap in Layers, Calls in Tools, Hours via the always-on slider bar, Compass via My location).

## Not in scope
Other states than Kentucky; new species; offline Esau. Offline maps button stays parked as today.

## Order of work (each is its own plan, PR, review)
1. Clean interface (visible, low risk, independent of the brain).
2. Kentucky rules table (by species and weapon) and legal-hours block.
3. Teaching layer, weapon choice and find-the-trail lessons.
4. Source library (whitetail first).
5. Quality check set.

## Who builds what
- Esau's brain and teaching (Part A): this thread.
- Map-screen cleanup (Part B): the "Streamline the hunt by chosen species" thread, after Quinn approves.
- Calls and ginseng content: the calls and ginseng thread. Deer food, bed and trail prediction: the deer prediction thread. This thread consumes their outputs and does not duplicate them.
