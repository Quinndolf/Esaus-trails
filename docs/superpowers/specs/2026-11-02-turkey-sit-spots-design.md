# Turkey sit spots and Kentucky turkey rules: design

Status: implemented in this PR.

## Why
Turkey is the last of Quinn's four species. Esau already knows turkey behavior (`src/esau/species/turkey.ts`) but gives no map spots and the rules table has no turkey dates, so a turkey hunter got no sit spots and an "unknown" legal read.

## Rules (Monroe County, from KDFWR)
Sources: https://fw.ky.gov/Hunt/pages/spring-turkey-hunting.aspx and https://fw.ky.gov/Hunt/Pages/TurkeyHunt.aspx, read 2026-11-01.
- **Spring general season:** April 18 to May 10, 2026. Shotgun, bow, crossbow and muzzleloader. Bearded turkeys only (a male, or a hen with a visible beard), one a day, two for the spring, 30 minutes before sunrise to 30 minutes after sunset, no baiting. The youth weekend (April 4-5) is before the table starts, so it reads "unknown".
- **Fall:** shotgun Oct 24-30 and Dec 5-11, 2026; archery Sept 5, 2026 to Jan 18, 2027; crossbow Oct 1-18 and Nov 14 to Dec 31, 2026. Fall turkey is open only in listed counties and Monroe County was not confirmed, so every fall window is marked `unconfirmed` and Esau says to check the guide.
- A rifle or air gun is not a legal turkey weapon: closed, naming the legal ones. A muzzleloader outside spring is `unknown` (no fall dates found).

## Sit spots
A turkey is all eyes and ears, so the model ignores wind and scent. Two kinds of spot by the hour, in the same `SitSpot` shape (new kinds `roost` and `strut_zone`):
- **Roost ridge** (from 1.5 hours before sunrise to 30 minutes after): timber on a ridge, bench or upper slope, with an opening close by. The note says to slip in before light, stay 100 to 200 yd back and never walk up under the roost. Faces the opening they fly down to.
- **Strut zone** (after that, until 30 minutes past sunset): open, gentle ground (pasture, hay, crop, shrub) with woods beside it. Faces the woods they come out of. The note says sit still against a wide tree in shade.
- **Hour and season:** in spring, late morning (3 to 5 hours after sunrise) is the peak, when hens leave for their nests and lonely gobblers answer. Fall birds are in flocks and feed morning and afternoon; the midday lull is low. After dark: no spots.
- Oak-hickory (USFS type 500) counts a little more, pine-only ground a little less.

## What it cannot see
Tree size, water, fresh sign, scratchings, droppings and other hunters. Esau says these are predictions from ground and hour, never that a bird is there.

## Rules kept
Free data only. No marks or photos leave the phone. Wired into `analyzeHour` for turkey when the ground has land cover, the same as squirrel.

## Not in scope
Calling strategy, decoy setups, a tree-types layer, the youth weekend.

## Tests
Rules: spring open and bag note, fall windows by weapon with the unconfirmed flag, next opening named, rifle and air gun closed, fall muzzleloader unknown. Model: phase and season, spring peak over fall, strut zones on open ground beside woods, roost ridges on timber facing the opening, ridge preferred, none at night or without usable ground, no scent wording, unsure in the midday lull. Analyze and brief: kinds pass through and Esau is told to give no scent advice.
