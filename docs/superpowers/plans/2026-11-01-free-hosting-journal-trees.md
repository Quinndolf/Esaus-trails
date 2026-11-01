# Free Hosting, Hunt Journal, Tree Types: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native). Steps use checkbox syntax. Three independent parts, each its own PR: A (free hosting), B (hunt journal), C (tree types).

**Goal:** Quinn can open the app on a phone for free (A), look back at a hunt and see what Esau would have said (B), and get honest forest-type hints for saddle-hunting trees (C).

**Architecture:** A: the existing front end plus the existing Node handlers (`server/ground`, `server/esau`, an NWS proxy) deployed on Vercel's free Hobby plan: `api/*.ts` wrappers reuse the handlers unchanged. B: pure functions over the tracker's saved tracks plus the wind model, on-phone only. C: a free USDA Forest Service forest-type lookup behind the ground builder, tested with fixtures, shown only with "predicted" wording.

**Tech Stack:** TypeScript, Vitest, Vercel Hobby (free), existing zustand/IndexedDB tracker (`src/tools`).

**Spec:** `docs/superpowers/specs/2026-10-31-esau-teaches-and-clean-ui-design.md` (items 1, 10, 17, 22, 23; A9 hunt tracker).

## Global Constraints
- Free tools only. No paid service, no credit card. Esau's Claude call is off unless Quinn adds a key later; the app then uses Esau's built-in offline read.
- Everything the hunter marks, tracks or answers stays on the phone. Journal and debrief run on the phone; nothing is uploaded.
- Kentucky, Monroe County first. Weather source stays NWS then Open-Meteo.
- Esau says forest-type results are predictions from map data, never "that tree is a white oak".

## Review Focus
- Hosting: the `/api/esau` function with no key must answer 503 (so the app falls back to offline), never 500 (Task A2).
- Hosting: an unlisted `/api/*` path returns 404 JSON, not the app's HTML page (A2).
- Journal: a track with 0 or 1 points, or points with no timestamps, must not crash (B1).
- Journal: standing still under 5 minutes is not a sit; a GPS jump is not 300 yards of walking (B1).
- Trees: the forest-type service being down returns no tree hint, not an error and not a guess (C1).
- Trees: no hint outside forest cover (fields, water) (C1).

## Part A: Free hosting on Vercel Hobby

### Task A1: Vercel config and function wrappers
**Files:** Create `vercel.json`, `api/ground.ts`, `api/esau.ts`, `api/health.ts`, `api/nws.ts`; Test `api/__tests__/api.test.ts`.
**Interfaces:** Produces default-exported `(req: IncomingMessage, res: ServerResponse) => Promise<void>` per file. `vercel.json` rewrites `/api/nws/:path*` to `/api/nws?path=:path*`, sets SPA fallback to `/index.html` only for non-`/api` paths, and gives `api/ground.ts` and `api/esau.ts` `maxDuration: 30`.
- [ ] Failing tests: `api/health` returns `{ok:true, esau:false}` with no key; `api/esau` with no key returns 503 JSON; `api/ground` with no query returns 400 JSON; `api/nws` with a path outside points/gridpoints/stations returns 404 JSON.
- [ ] Implement wrappers calling `handleGround`, `handleEsau`, and a new `server/nws.ts` `handleNws(req,res)` extracted from `server/index.mjs` `proxyNws` (index.mjs imports it too, behavior unchanged).
- [ ] Run tests, `npm run typecheck:server`, `npm run build`; commit.

### Task A2: Quinn's steps and a free-run smoke test
**Files:** Create `deploy/vercel.md` (copy-paste steps for a non-technical user: sign in with GitHub, Import the repo, framework Vite, set `NWS_USER_AGENT`, Deploy, open the URL on the phone, Add to Home Screen); Create `scripts/smoke.mjs` (`node scripts/smoke.mjs https://your.url`: checks `/api/health`, `/api/ground?lat=36.75&lng=-85.7`, `/` and `/api/nope`); modify `.github/workflows/ci.yml` to run `node --check scripts/smoke.mjs`.
- [ ] Write both; no unit test beyond `node --check`. Commit; open PR; say plainly that the deploy itself needs Quinn's Vercel sign-in and the live endpoints were not run from here.

## Part B: Hunt journal

### Task B1: Pure track analysis
**Files:** Create `src/journal/analyze.ts`; Test `src/journal/__tests__/analyze.test.ts`.
**Interfaces:** Consumes `Track` (`src/tools/types.ts`: points with lngLat, time). Produces `analyzeTrack(track: Track): { distanceYd: number; durationMin: number; sits: { lngLat: LngLat; minutes: number; start: number }[]; }` and `scentCrossings(track: Track, a: { windFromDeg: (lngLat: LngLat, at: number) => number; beds: LngLat[]; trails: LngLat[] }): { at: number; lngLat: LngLat; what: 'bed' | 'trail'; yards: number }[]`.
- [ ] Tests: straight 100 m walk gives about 109 yd; 6 minutes within 15 yd is a sit and 4 minutes is not; a 1 km GPS jump with 1 s gap is ignored; 0 or 1 point and missing times return zeros and no crash; a walk with wind carrying scent toward a bed within 150 yd and 30 degrees yields one crossing, and wind from the other side yields none.
- [ ] Implement; commit.

### Task B2: Local debrief text
**Files:** Create `src/journal/debrief.ts`; Test `src/journal/__tests__/debrief.test.ts`.
**Interfaces:** Produces `debriefLines(a: Analysis, ctx: { species: SpeciesId; weapon: Weapon | null }): string[]` from fixed templates in Esau's voice (plain, short). No network.
- [ ] Tests: a crossing produces one line naming the bed or trail, the yards and "your scent"; no crossings produces one "clean walk" line; a long sit produces a line with minutes; output never contains the words "photo" or "note".
- [ ] Implement; commit.

### Task B3: Journal screen and exit prompt
**Files:** Create `src/journal/JournalSheet.tsx`, `src/journal/store.ts` (IndexedDB via `idb`, store `esau-journal`: `{id, trackId, date, species, weapon, snagged: 'yes'|'no'|null, what?: string}`); modify `src/tools/components/SavedSheet.tsx` (open a hunt), `src/home/ExitPrompt.tsx` (save the answer to the journal).
**Interfaces:** Produces `useJournal` (zustand): `entries`, `load()`, `add(entry)`, `setSnagged(id, v, what?)`.
- [ ] Tests (jsdom): saving "yes, a doe" stores it and lists it; the journal sheet shows distance, duration, sits and debrief lines for a fixture track; nothing is sent to `fetch` (spy asserts zero calls).
- [ ] Implement, replay the track with the hour slider is a later step (not in this plan); commit.

## Part C: Tree types (forest-type hints)

### Task C1: Forest-type lookup
**Files:** Create `server/ground/forest.ts`; modify `server/ground/ground.ts` (add optional `forestType` to the grid, already an accepted input), `src/esau/brief.ts` (a TREES line); Test `server/ground/forest.test.ts`.
**Interfaces:** Produces `fetchForestType(b: Bbox, cols: number, rows: number, f?: Fetch): Promise<Uint8Array | null>` (cell codes per `FOREST_GROUP` in `src/model/food.ts`; null on any failure) and `treeHint(grid, cell): string | null` returning e.g. "Oak-hickory ground, so white and red oaks are likely; look for acorns and bark" only when the cell is forest.
- [ ] Research first: find a free, keyless USFS forest-type-group endpoint and confirm it answers over HTTPS; record URL and date in the file header. If none answers, stop, record the finding in the PR, and ship only the hint wording and tests with the lookup returning null.
- [ ] Tests with a stubbed fetch: service error returns null; a forest cell gives a hint that contains "likely" and never says "is a"; a field cell gives null.
- [ ] Implement; commit.
