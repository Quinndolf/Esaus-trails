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
- Two modes: the **short read** (default, 2 to 4 sentences) and **Teach me more** (a short lesson tied to this exact spot: why here, why this wind, what to look for on the ground, what to do first). Reasoning order for every answer: law and safety, scent (wind and thermal), terrain, animal behavior, then the lesson.
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

### A7. Analyze Area: Esau predicts where the animal is and where it's headed
Both ways to ask stay (Quinn, 2026-10-31): **tap a spot** for Esau's exact read of that point, and a permanent **Analyze area** button for the whole view. It sits in the Tools-adjacent bottom row (a labeled pill, not another round button) and also replaces the "Read this area" pill.
Analyze Area reads the ground around the map view for the chosen animal, weapon, hour and weather, then:
- Marks the most likely **bedding, feeding, trails/travel routes, and wind-covered ground** (wind and thermal cover: where the hunter's scent will not reach).
- Predicts the **direction of travel and destination** at the chosen hour: for example "at 6:40 AM they leave the bedding bench heading southwest down the draw toward the soybean field". Shown as flow arrows on the trails that change as the slider moves.
- Esau narrates it as a lesson: the one best spot to set up for this hour and weapon, why, how to walk in, and when to expect movement.
Build split: the prediction maps and flow (food, bed, trail layers) come from the existing movement model and the deer-prediction thread's work; this thread adds a per-hour **direction-of-travel** step on top (bed to food in the morning, food to bed at dawn, travel along trail edges by hour and phase) and Esau's narration of the result. Other animals use the same pipeline with their own rules (turkey roost to strut zone, squirrel nut trees, ginseng habitat).
Integration facts (from the prediction thread): direction of travel is a separate module that reads `MovementHour.trails`, `activity.heading` and `presence` per hour and does not edit `movement.ts` internals. **Wind cover is not modelled yet** (only a small lee bonus to bedding at 12 mph or more), so this thread adds a wind-cover layer from the existing scent/wind model. Food is a prediction from land cover, topography and optional crop data, and Esau's wording says so; the live crop and aerial-imagery fetches are still untested.
Tests: flow direction flips between dawn, midday and dusk on a fixture; arrows follow trail cells; wind-cover cells are downwind-safe for the hunter's position.

### A8. Esau's character: the great hunter
Esau is the hunter of the old story: the skilled man of the field, rough, quick, at home in the open country, who came in from the hunt. The persona keeps that spirit (a master hunter and a patient teacher), never preachy, no scripture quoting. He speaks as someone who has lived the hunt and wants the newcomer to get the same thing. This is voice and heart, not content: the facts still come only from the source shelves above.

### A9. Hunt tracker and after-hunt review
The route tracker already exists (Tools: records the path with distance and duration, saved on the device). Quinn wants it to be a hunt journal. Additions:
- **Track saves with the hunt's context:** animal, weapon, start and end time, wind and thermal at each hour, and the pins and photos made along the way. Also records stops (standing still over about 5 minutes) as "sits".
- **Review at home:** open a saved track, draw it on the map, scrub it with the hour slider to replay it, with the wind arrow at each moment.
- **Planned route vs. walked route:** the hunter can draw a plan (draw tool) before the hunt. Esau suggests an approach route from the map (downwind, quiet, off the trails animals use). After the hunt the three lines show together: Esau's suggested route, the plan, the walked track.
- **Esau's debrief:** "You came in from the southwest with the wind at your back, so anything on that bench smelled you at about 6:50. Next time come up the creek from the east." Teaching tone, tied to the lesson rules. He flags where scent crossed likely beds or trails, and where the hunter walked the animals' travel line.
- **Privacy:** tracks stay on the device by default, like photos.
Build split: tracker recording and storage belong to the tools code already there (map-screen thread); this thread adds the review view, route suggestion and debrief. Tests: scent-crossing detector on a fixture track, stop detection, planned-vs-walked distance.

## Part B: Cleaner interface
Today the map screen carries 8 buttons plus pills: Layers, Hours, Tools, Call, Basemap, Compass, Locate, (Offline hidden), the animal pill, GPS pill and accuracy readout.

Proposed (3 buttons plus one chip):
- **Top-left chip**: the animal ("Whitetail"). Tap to switch species. The chip shows the chosen hour beside it.
- **Hour slider bar, always on screen** (Quinn's request): a thin bar at the very bottom edge of the home map, running left to right, always visible once an animal is chosen, never hidden behind a button. Dragging it moves the whole app to that hour: the movement overlay, Esau's read, and a live strip above the bar showing that hour's wind arrow and speed, temperature, and thermal state (rising, sinking, settled, pooling). The bar itself is tinted by thermal state across the day and marks sunrise, sunset and legal shooting light, so a beginner sees at a glance when air rises, when it sinks, and when it is legal to shoot. It reuses the existing hour store and thermal model. The bar is slim (about 40 px tall when idle) and see-through (about 55% opaque, blurred behind), growing to the full readout line only while the finger is on it.
- **Animal swipe wheel** (see item 24; replaces the dropdown idea): slim, does not cover the map, followed by a weapon question. Replaces the full-screen picker.
- **Analyze area**: a permanent labeled pill (see A7), and tapping any spot still gives Esau's read of that spot. The app still reads the ground automatically when an animal is picked.
- **Right, one stack of two**: **Layers** (basemap choice moves inside the Layers sheet as a row at the top) and **My location**. Tapping My location centers; tapping again turns on the compass cone and bearing. No separate compass button.
- **Bottom center**: **Tools** (Swiss-army icon). Calls, photos, saved, mark my location, measure, draw, tracker all live in it. The Call button goes inside Tools.
- Status (GPS accuracy, elevation, "finding you") shows only as a thin line when something is wrong, and in the spot sheet otherwise.
- Esau's sheet: one drag-up card with Quick Read first and a "Teach me" button. Map stays visible above it.
- Visual: one corner radius, one shadow, white at 90% opacity, no text labels on buttons (icons plus accessible names), 40 px touch targets, same spacing everywhere.
Result: from 8 buttons to 3 plus a chip; the map shows roughly the whole screen when nothing is open.

Tests: existing UI tests updated; a screenshot test at phone size for the idle screen; check every removed control is reachable (Basemap in Layers, Calls in Tools, Hours via the always-on slider bar, Compass via My location).

## Quinn's decisions (2026-10-31, later in the day). These override anything above that conflicts.
1. **Privacy:** Esau never sees the user's photos, marks, trails, tracks or stands, and nothing of theirs is uploaded. He reads only land, wind and weather, plus the hunter's position, animal, weapon, hour and chosen sit spot. The "Ask Esau about this photo" feature and the photo upload toggle come out. Esau drops his own suggested marks, styled differently from the user's. **Effect on A9:** the debrief (scent crossings, planned vs. walked) is computed on the phone from rules and written from fixed templates; the track never goes to the server or to Claude.
2. **Kentucky only.** No other states, nothing to save for them.
3. **Short answers:** 2 to 4 sentences, shorthand is fine, with a **Teach me more** button for the fuller lesson (replaces the Quick Read / Teach me naming).
4. **Advisory banner:** a big banner when it is out of season or illegal right now, and when the wind is wrong for the spot. Esau still gives movement and behavior advice under it. Not flagged: private land, permission, nearness to a house or road.
5. **Safety, not nagging:** in gun season remind about blaze orange; flashlight when light is low; a battery warning below 50%. One short line, once per hunt.
6. **Tap where you will sit:** the hunter taps the map to say where they will sit and shoot from. Esau then tells them what they should see from there (lanes, trails, distance by weapon) and marks it. The tapped spot stays private to the phone for the read: only its coordinates go with the request, with no name, notes or photos.
7. **Ginseng gets the deepest knowledge:** quick Kentucky rules for collecting (season, permits, berry replanting), then a very detailed teaching section: how to find it, where it grows and what draws it, identification through the seasons with real photographs, digging, replanting, preserving and harvesting. Real photos need licensed sources (public domain or permissioned, such as USDA and university extension); cannot be generated or invented. Owned jointly with the ginseng thread.

8. **Trails already shown:** when the hunter analyzes or looks in a direction, the predicted trails are already drawn on the map; Esau does not make them appear on request. **Range reader:** tapping a spot shows its distance from the hunter (or the chosen sit spot) with a bow-range and rifle-range note for the chosen weapon.
9. **Esau suggests where to sit, hunt and look,** especially when the wind is wrong for the chosen spot: he offers a better sit spot, with the direction to watch.
10. **Everything the hunter marks stays on the phone,** including ginseng spots, trails, stands and feeding plots. Free for now; paid features later.
11. **Ginseng photos:** use the ones we can legally source, in the seasons we can; gaps are fine.

12. **Top three spots:** Esau suggests the three best places to sit, ranked, each with its direction to watch and why.
13. **Time:** answers default to now and re-run whenever the hour slider moves.
14. **Offline:** with no connection Esau falls back to the downloaded area and the last weather fetched, and says how old that weather is.
15. **What would make Quinn delete the app:** slow, wrong advice, battery drain. So these are acceptance criteria: a read returns fast (target under 3 seconds on a normal connection, instant from cache offline), advice says "not sure" before guessing, GPS and compass run only when needed, and no background work when the app is idle.

16. **Home ground: Monroe County, Kentucky.** Rules, seasons and the test spots are tuned for Monroe County (KDFWR deer zone and county rules checked first). Priority animals: **deer and squirrel**; ginseng stays; turkey is nice-to-have and comes last; elk, bear, hog, mule deer stay in the app but get no new work now.
17. **"Did you snag anything?"** when the hunter exits the app (or ends a tracked hunt), one quick question: yes/no, what, and where. The answer is saved on the phone only, shown in the hunt journal, and never sent anywhere. It feeds the hunter's own record, not Esau's server.
18. **Controls:** normal-size buttons, not oversized; gloved fingers are accurate enough. This replaces the 44 px touch target note: use the standard 40 px. No night mode for now. GPS and compass run only when needed and are off when idle.

19. **Quinn's weapons:** squirrel with a **pellet gun (air rifle)**; deer with a **bow and a crossbow**, maybe from a **tree stand**. Weapon list becomes: bow, crossbow, rifle, muzzleloader, shotgun, pellet gun. The rules table must say whether a pellet gun is legal for squirrel in Monroe County and under what conditions; if the KDFWR source is not confirmed, Esau says "check the guide" and does not guess. Tree stand: one short safety line per hunt (full-body harness, stay connected).
20. **Teach only on request.** Default answers are the 2 to 4 sentence read. Lessons, rules of thumb and explanations appear only after Quinn taps "Teach me more". This removes the "one rule of thumb in every answer" and "asks a question back" behaviors from A3; the advisory banner and the one-line safety reminder stay.
21. **After a harvest: the legal steps.** A "Got one" flow (reached from the exit prompt or Tools) walks the hunter through what Kentucky requires: tagging, check-in, the phone numbers and websites to use, and public vs. private land differences. Content comes from the dated rules table with source and verified date; Esau does not state a number or step that is not in the table.

22. **Saddle hunting, and squirrel range.** Deer from a saddle (tree-saddle) setup: setup advice picks trees, not stand sites (a straight, climbable tree with cover and a shooting lane, set up downwind), with the usual safety line (lineman's rope, stay connected). Squirrel shots with the pellet gun are within 40 yards, so the squirrel read and range reader use 40 yards as the working range.
23. **Tree types (feasibility, to confirm before promising):** the model already accepts forest-type and greenness inputs. Real sources, all free: the USFS forest-type groups map (30 m, oak-hickory, maple-beech and so on), NLCD (deciduous, evergreen, mixed), satellite greenness (NAIP and Landsat), and USDA soil maps (SSURGO) as a hint for what grows where. These give forest groups, not individual trees, so Esau says "oak-hickory ground, likely white and red oak" and tells the hunter what to look for on the ground, never "that tree is a white oak". A live test of these services from the app is the first task of the plan; until it passes, none of it is shown to Quinn as fact.

## Reconciled with the product brief (/mnt/project-files/esaus-trails/product-brief.md). Where it differs from earlier text, the brief wins.
24. **Species is a slim swipe wheel, not a dropdown.** A narrow wheel on the chip's row that does not cover the map. Order: deer, squirrel, ginseng, turkey (turkey last), then the rest. After the animal is picked the app asks which weapon (deer: bow or crossbow; squirrel: pellet gun; ginseng: no weapon, shows a tool list instead). The dropdown mockups (screen 2) are replaced.
25. **First launch:** a short button-by-button tutorial, then always straight to a minimal map.
26. **Tap = sit spot and read.** Tapping the map sets the sit spot. The answer leads with what the animal is doing right now at that hour, 2 to 4 short sentences, plus "Teach me more". The map shows the trails already known in the direction the hunter faces and a range reader for the chosen weapon (bow, crossbow, pellet gun). This merges the earlier separate "tap a spot" and "sit spot" items.
27. **Offline:** online by default, plus a **Download this area** button in the Layers or Tools menu. The parked Save maps button comes back as this button. Offline falls back to the downloaded area and the last weather fetched.
28. **Weather and GPS:** weather is fetched on app open or refresh; GPS is off when not in use.
29. **Open items before Esau states them:** verify with KDFWR the pellet-gun squirrel rules, crossbow dates and the check-in process; check data coverage for Monroe County (terrain, forest type, soil). Quinn's squirrel reason was cut off ("Squirrel more for...").
30. **Land:** private land first (assume permission, not a warning trigger); public land later.

31. **Top-3 ranker is not built here.** The deer-prediction thread builds the top-3 sit-spot ranker (and the 10 m terrain swap). This thread takes its output, narrates the three spots in Esau's voice (short read plus "Teach me more"), and draws his marks. Step 5 of the order of work consumes the ranker; it does not build one.

32. **Hour slider position (Quinn, 2026-11-01):** the hour slider is on the home map itself, at the very bottom, running left to right (hours of the day). Moving it moves the thermal predictions on the map and Esau's suggested route and top-3 sit spots, together. The Tools button sits just above it. This replaces any earlier idea of keeping the slider only on Esau's read screen.

33. **Preview decisions from Quinn (2026-11-01; mockups in /mnt/project-files/esaus-trails/preview/, home-thermal-shading-v4.png and full-flow-v1.png):**
    - Thermal shading on the map: **dark red where air is pulling down (sinking), light blue where it rises**; redraws as the hour slider moves, together with Esau's suggested route and sit spot.
    - Look: light, frosted, Apple-like; no bold dark panels. This overrides the dark chrome in my early mockups.
    - **Animal list scrolls up and down at the top** (vertical scroll list), replacing the swipe wheel in item 24.
    - Thermal rule for Esau and the shading: rising air in the morning after the sun hits slopes, falling in the evening; a prevailing wind over 15 mph overrides thermals (the shading fades and Esau says the wind rules).

## Not in scope
Other states than Kentucky; new species; offline Esau. Offline maps button stays parked as today.

## Order of work (each is its own plan, PR, review)
1. Clean interface: chip, dropdown with weapon, slim hour bar, Analyze area pill, Tools menu (map-screen thread).
2. Privacy cleanup: remove photo "Ask Esau" and the upload toggle; marks stay local.
3. Kentucky (Monroe County) rules table by species and weapon, legal hours, advisory banner, safety lines, "Got one" legal steps.
4. Short answers plus Teach me more; Esau's persona as the great hunter.
5. Analyze area: top three spots, direction of travel, wind cover, sit-spot tap and range reader.
6. Hunt journal: tracker review, local debrief, "did you snag anything?"
7. Ginseng deep teaching (with the ginseng thread); source library and test-spot checks run alongside steps 3 to 6.

## Who builds what
- Esau's brain and teaching (Part A): this thread.
- Map-screen cleanup (Part B): the "Streamline the hunt by chosen species" thread, after Quinn approves.
- Calls and ginseng content: the calls and ginseng thread. Deer food, bed and trail prediction: the deer prediction thread. This thread consumes their outputs and does not duplicate them.
