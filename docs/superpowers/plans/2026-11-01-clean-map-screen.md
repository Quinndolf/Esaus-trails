# Clean Map Screen (Part B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Replace the busy map screen with: one animal chip (top-left), Layers + My Location (right), Tools (bottom center), a slim always-on hour bar (very bottom), and an Analyze area pill. Thermal shading becomes dark red (sinking) / light blue (rising).

**Architecture:** New UI lives in `src/home/` (pure helpers + small components) so nothing under `src/esau`, `server/esau` or `src/rules` changes. Weapon, which the Esau brain thread will own on `useEsau`, is held in a tiny bridge store `src/home/weapon.ts`; when their PR lands, the bridge is swapped to read `useEsau.weapon`. `analyzeArea` is called on `useEsau` if present, else falls back to `tapSpot(map center)`.

**Tech Stack:** React 18, zustand, MapLibre GL 5, vitest (+jsdom for components).

**Spec:** docs/superpowers/specs/2026-10-31-esau-teaches-and-clean-ui-design.md (branch claude/project-thread-5yli87), Part B, items 24-27, 32, 33.

## Global Constraints
- Do not edit `src/esau`, `server/esau`, `src/rules`.
- Animal list order: deer (whitetail), squirrel, ginseng, turkey, then the rest. Weapon step after: deer bow/crossbow (+rifle, muzzleloader, shotgun), squirrel pellet gun (+shotgun, rifle), ginseng none.
- Chip text: "Whitetail · Crossbow". Buttons 40px. Light frosted style (white ~85% + blur).
- Thermal colors: sinking dark red, rising light blue. Wind over 15 mph fades the shading, gone by 20 mph.
- Hour bar ~55% opaque, always on once an animal with hour scope is chosen. Status line only when something is wrong.
- Exit answer ("Did you snag anything?") stays on the phone only.

## Review Focus
- Wind 0, 15, 17.5, 25 mph: shading alpha full, full, half, zero.
- Animal without hour scope (ginseng) shows no hour bar and no Analyze pill reading hours.
- Weapon invalid for a newly chosen animal resets to that animal's first weapon.
- Second tap on My Location turns compass on; third tap off; compass denied shows the status line.
- localStorage unavailable never throws (tutorial seen, weapon, snag log).

### Task 1: Thermal shading colors and wind fade
Files: `src/home/shade.ts`, `src/hour/overlays.ts` (thermalPixels), tests `src/home/__tests__/shade.test.ts`, update `src/hour/__tests__/overlays.test.ts`.
Produces: `windFade(mph: number): number`, `THERMAL_RGB`.
- [ ] Test: `windFade` 0/15 -> 1, 17.5 -> 0.5, 25 -> 0. Rising pixel is light blue (b > r), sinking and pooling dark red (r > b, r < 200), and pixel alpha scales by windFade.
- [ ] Implement and wire into `thermalPixels`.

### Task 2: Hour bar model
Files: `src/home/hourBar.ts`, test `src/home/__tests__/hourBar.test.ts`.
Produces: `barSegments(cells: StripCell[]): {from:number;to:number;state:number}[]` (fractions 0-1), `lightMarks(hours: Date[], sunrise: Date, sunset: Date): {sunrise:number;sunset:number;legalStart:number;legalEnd:number}` (legal = 30 min before sunrise to 30 min after sunset, clamped 0-1), `readout(hc): string` like "Rising · NW 6 mph · 52°".
- [ ] Tests with fixtures; implement.

### Task 3: Animals and weapons
Files: `src/home/weapon.ts`, test `src/home/__tests__/weapon.test.ts`.
Produces: `ANIMAL_ORDER`, `WEAPONS_FOR(species): Weapon[]`, `useWeapon` store `{weapon, setWeapon, ensureFor(species)}`, `chipLabel(species, weapon)`.
- [ ] Tests (order, chip text "Whitetail · Crossbow", reset on invalid weapon, ginseng none); implement.

### Task 4: Components
Files in `src/home/`: `AnimalChip.tsx`, `HourBar.tsx`, `LocationButton.tsx`, `AnalyzePill.tsx`, `Tutorial.tsx`, `ExitPrompt.tsx`, `snag.ts`, `home.css`. Modify `ToolsSheet.tsx` (Calls moves in), `LayersSheet.tsx` (Download this area row).
- [ ] Tests (jsdom): chip opens list then weapon step and sets species/weapon; location button cycles center -> compass -> off; tutorial shows once and Skip persists; snag answer saves locally.
- [ ] Implement.

### Task 5: App integration
Modify `src/App.tsx`: new layout, remove Hours button/panel, basemap and compass buttons, offline gate, accuracy readout (status line only on problem); drop photo "Ask Esau" and `setPins`. Keep tracker chip.
- [ ] Update affected tests; `npm test`, `npm run build` green.
- [ ] Review (superpowers:requesting-code-review), verify, PR, merge on green.
