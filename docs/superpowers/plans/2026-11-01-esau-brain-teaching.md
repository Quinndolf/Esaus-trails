# Esau's Brain: Rules, Short Answers, Advisories, Privacy, Top-3 Narration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native, this session). Steps use checkbox syntax.

**Goal:** Esau reads the land for Quinn in 2 to 4 short sentences with a "Teach me more" body, shows big advisories (out of season, wrong wind), narrates the ranked top-3 sit spots, knows Kentucky rules and safety, and never receives anything private.

**Architecture:** Pure TS modules in `src/rules/` and `src/esau/` (rules table, advisories, safety lines) feed the existing field-report brief. The server reply schema gains `more`. The client store gains `weapon` and `analyzeArea`. Nothing from the hunter's marks, photos or tracks reaches the brief.

**Tech Stack:** TypeScript, Vitest, zustand, zod (server/esau/schema.ts), existing `src/model/sitSpots.ts`.

**Spec:** `docs/superpowers/specs/2026-10-31-esau-teaches-and-clean-ui-design.md` (items 1 to 8, 12 to 21, 24 to 33).

**Out of this plan (separate plans):** map-screen UI (map thread), ginseng deep content (ginseng thread), hunt journal and debrief, tree-type data, Teach-me tutorial copy.

## Global Constraints
- Kentucky only; home county Monroe. Deer and squirrel first. Free tools only (Open-Meteo/NWS stay the weather source).
- Answers: `say` is 2 to 4 sentences, shorthand allowed. Teaching only in `more`, shown only after "Teach me more".
- Esau never receives photos, waypoints, tracks, stands or notes. No upload.
- Rules text comes only from the dated table; a missing or stale entry returns `unknown` and Esau says "check the KDFWR guide". Never guess.
- Not triggers for advisories: private land, nearness to house or road. Triggers: out of season or illegal, wrong wind.
- Sit spots are narrated as predictions (from `topSitSpots`), not facts.
- Weapons: bow, crossbow, rifle, muzzleloader, shotgun, pellet.

## Review Focus
- Hunter marks or photo notes appear in the brief or request body -> must be absent (Task 1 test).
- A rule entry past its season year or missing for the weapon -> `unknown`, not "legal" (Task 2).
- Wind over 15 mph: thermals ignored, Esau says wind rules (Task 3).
- Reply with 6 sentences in `say` -> rejected/trimmed, long text moves to `more` (Task 5).
- Zero sit spots / `unsure` -> Esau says the ground gives little, no invented spots (Task 6).
- Battery unavailable (iOS Safari has no Battery API) -> no battery line, no crash (Task 4).

## File Structure
- Create `src/rules/kentucky.ts` (data + `legalToday`), `src/rules/types.ts`.
- Create `src/esau/advisory.ts` (banner decisions), `src/esau/safety.ts` (reminder lines).
- Modify `src/esau/types.ts`, `src/esau/brief.ts`, `src/esau/persona.ts`, `server/esau/schema.ts`, `server/esau/route.ts`, `src/esau/ui/store.ts`, `src/esau/offline.ts`, `src/App.tsx`, `src/photos/components/PhotoPinSheet.tsx`.
- Delete `src/esau/photo.ts`, `src/photos/esauPhotoInput.ts` (and their tests/exports).

---
### Task 1: Privacy cleanup
**Files:** Modify `src/esau/types.ts` (remove `Pin` use in `SpotQuery`, `SpotPhoto`, `photo`), `src/esau/brief.ts`, `src/esau/ui/store.ts` (remove `askPhoto`, `setPins`, `photo`), `src/App.tsx` (remove `setPins` effect and `onAskEsau`), `PhotoPinSheet.tsx` (remove `onAskEsau` and its button), `src/photos/upload.ts` (remove the upload toggle UI if exposed); Test `src/esau/__tests__/privacy.test.ts`.
**Interfaces:** Produces: `SpotQuery` without `pins` or `photo`. `buildBrief(q)` output never contains pin names or notes.
- [ ] Failing test `brief never includes hunter marks`: build a query via the fixture with an extra `pins` field cast in; assert `buildBrief(q).text` does not contain the pin's name or note strings, and `validate()` in route rejects a body with `photo`.
- [ ] Run, expect FAIL; implement removals; run full `npm test`; fix imports.
- [ ] Commit `Remove photo and mark sharing with Esau`.

### Task 2: Kentucky rules table
**Files:** Create `src/rules/types.ts`, `src/rules/kentucky.ts`; Test `src/rules/__tests__/kentucky.test.ts`.
**Interfaces:** Produces `type Weapon = 'bow'|'crossbow'|'rifle'|'muzzleloader'|'shotgun'|'pellet'`; `type Legal = {status:'open'|'closed'|'unknown'; note:string; source?:string; verified?:string; seasonLabel?:string}`; `legalToday(a:{species:SpeciesId; weapon:Weapon|null; at:Date; county?:string}): Legal`; `LEGAL_HOURS_NOTE`; `harvestSteps(species): {steps:string[]; phones:string[]; source:string; verified:string}|null`.
- [ ] Research: fetch 2026-27 KDFWR deer (archery, crossbow, zone 2 for Monroe), squirrel, ginseng and check-in rules from fw.ky.gov; record each with source URL and `verified` date; pellet-gun squirrel and anything unconfirmed stays `unknown`.
- [ ] Tests: in-season bow date -> `open`; day after close -> `closed`; weapon not allowed in that season -> `closed` with note; unlisted species/weapon -> `unknown`; entry whose season year is before `at` -> `unknown`.
- [ ] Implement table-driven `legalToday`; run; commit.

### Task 3: Advisories
**Files:** Create `src/esau/advisory.ts`; Test `src/esau/__tests__/advisory.test.ts`.
**Interfaces:** Consumes `Legal`. Produces `type Advisory = {kind:'out_of_season'|'illegal'|'wrong_wind'; title:string; detail:string}`; `advisories(a:{legal:Legal; wind:{mph:number; fromDeg:number}; sit:{lngLat:LngLat}|null; targets:{lngLat:LngLat}[]; }): Advisory[]`.
- [ ] Tests: `closed` -> one `out_of_season` advisory with title "Out of season"; `unknown` -> none (Esau just says check guide); wind blowing from the sit spot toward a target within 200 yd and 20 degrees -> `wrong_wind`; same geometry with wind below 3 mph -> none; no sit spot -> none; private land is never a trigger (no input for it).
- [ ] Implement with `bearingBetween`/`yardsBetween` from `src/model/geo.ts`; commit.

### Task 4: Safety lines
**Files:** Create `src/esau/safety.ts`; Test `src/esau/__tests__/safety.test.ts`.
**Interfaces:** Produces `safetyLines(a:{species; weapon:Weapon|null; legal:Legal; sun:{phase:string}; batteryPct:number|null; saddle:boolean; alreadyShown:Set<string>}): {lines:string[]; shown:string[]}` (each line once per hunt via `alreadyShown`).
- [ ] Tests: firearm weapon + open gun season -> blaze orange line; low light (dawn/dusk) -> flashlight line; battery 40 -> battery warning, 80 -> none, `null` -> none; saddle -> harness line; second call with the keys already in `alreadyShown` -> empty.
- [ ] Implement; commit.

### Task 5: Short answer + Teach me more
**Files:** Modify `server/esau/schema.ts` (add `more: z.string()`), `src/esau/types.ts` (`EsauReply.more`), `src/esau/persona.ts`, `server/esau/ask.ts` (post-check), `src/esau/offline.ts`, `src/esau/ui/EsauPanel.tsx` (button + body); Test `server/esau/ask.test.ts`, `src/esau/__tests__/esau.test.ts`.
**Interfaces:** Produces `splitAnswer(say:string): {say:string; overflow:string}` that keeps the first 4 sentences in `say` and moves the rest into overflow (appended to `more`).
- [ ] Tests: `splitAnswer` with 6 sentences -> 4 in `say`, 2 in overflow; with 2 -> unchanged; the persona text contains "what the animal is doing right now" and no scripture words; offline read returns `say` of 2 to 4 sentences plus non-empty `more`.
- [ ] Persona rewrite: the great hunter and patient teacher; `say` leads with what the animal is doing now at this hour; only `more` teaches (terms in plain words, one rule of thumb); say "not sure" before guessing; predictions not facts. Update schema + prompt; run; commit.

### Task 6: Weapon, sit spots and narration
**Files:** Modify `src/esau/types.ts` (`SpotQuery.weapon`, `SpotQuery.sitSpots: {rank:number;lat:number;lng:number;watchBearingDeg:number;yardsToTrail:number;reason:string}[]; sitUnsure:boolean`), `src/esau/brief.ts` (TOP SIT SPOTS block, LEGAL block, SAFETY block, ADVISORY block), `server/esau/route.ts` (validate), `src/esau/ui/store.ts` (`weapon`, persisted `esau-weapon`; `setWeapon`; `analyzeArea()`); Test `src/esau/__tests__/brief.test.ts`, `src/esau/ui/__tests__/store.test.ts`.
**Interfaces:** Consumes `topSitSpots` (src/model/sitSpots.ts), `legalToday`, `advisories`, `safetyLines`. Produces store actions `setWeapon(w:Weapon)` and `analyzeArea(center?:LatLng): Promise<void>`; `EsauReply.marks` with `kind:'stand'` are Esau's suggested sit spots (map styles them apart from hunter marks).
- [ ] Tests: brief with 3 sit spots lists them ranked with yards and bearing and says "predicted"; `sitUnsure:true` -> brief tells Esau to say the ground gives little and to invent none; brief contains the legal note and "check the KDFWR guide" when `unknown`; `analyzeArea` with a fixture grid calls the ranker with the current weapon and hour and sets `reply`; changing the hour re-runs from the same ground without refetching.
- [ ] Implement; run; commit.

### Task 7: Monroe County test spots
**Files:** Modify `server/esau/sample-spots.ts`; Test `server/esau/__tests__/spots.test.ts`.
- [ ] Add 6 fixtures near Monroe County for deer/bow and squirrel/pellet, mid-Nov and out-of-season dates; rule-check each fixture's brief: has legal block, has sit spots or `unsure`, no marks data, `say` split rule holds. Commit.

### Task 8: Verify and hand off
- [ ] `npm test` and `npm run build` pass; run `superpowers:requesting-code-review`, then `superpowers:verification-before-completion`.
- [ ] Open PR; message the map thread with the store interface (`weapon`, `setWeapon`, `analyzeArea`, `reply.more`, advisories, `marks[kind=stand]`); update memory `esau-brain-module`.
