# Squirrel sit spots: design

Status: proposed, for review. No code yet.

## Why
Esau gives deer ranked sit spots from trail and bed predictions (`src/model/sitSpots.ts`) but gives squirrel none. Squirrel is Quinn's second species, and a beginner needs "where do I sit and what time" most for the animal they are most likely to hunt first.

## What a squirrel spot is
Squirrels do not travel long trails the way deer do. Kentucky Fish and Wildlife says to look for food and cover: hickory, beech, pecan, black walnut and white oak; gray squirrels in mixed hardwoods with a dense woody understory, fox squirrels in drier uplands and fragmented woods, especially near corn. Both nest in large cavities and leaf nests. So a squirrel spot is a **food-tree stand**: a place with mast-tree habitat where a hunter can sit still and watch.

Source: Kentucky Department of Fish and Wildlife, Learn to Hunt Squirrel (https://fw.ky.gov/Hunt/Pages/Squirrel.aspx).

## Inputs the app already has
- Land cover (NLCD): deciduous and mixed forest score; evergreen and open ground do not.
- Terrain: hollows, creek bottoms and lower slopes (more mast and cover), ridge-top oak and hickory benches.
- Hour: first hours of daylight and late afternoon score highest; midday is low.
- Weapon: the pellet gun's 40 yd working range, plus the shotgun and rifle ranges from the existing table.

## What the app cannot see
Tree species. Until the tree-types layer exists (owned by the "Make Esau a hunter who teaches" thread), Esau scores hardwood cover only and says so: "I can't see which trees are nut trees. Look for hickory, beech, walnut and white oak, and for cuttings (shell piles)." Red oak is the last nut squirrels eat, so a stand of only red oak is a weaker pick. Fresh cuttings on the ground are the best sign and only the hunter can see them.

## Output
Top three food-tree stands for the hour, in the same `SitSpot` shape as deer so the map markers and range pill work unchanged. Reasons are plain ("hardwood bottom, good light in 20 minutes"). A squirrel answer also says to sit still, because squirrels detect movement and noise; wind and scent matter far less than for deer, so squirrel spots ignore scent.

## Rules kept
Free data only. No photos or marks leave the phone. Season, license and landowner permission come from the Kentucky rules table; the model never says a squirrel is present, only that the ground fits.

## Not in scope
Fox vs gray identification, dog hunting, a squirrel call model.

## Testing
Pure-function tests: hardwood scores above evergreen; dawn and late afternoon outrank midday; weapon range respected; flat or non-forest ground returns "unsure"; output shape matches deer spots.

## Open choice
Whether the tree-types layer should land first. Default: build with hardwood cover only and add tree species when that layer exists.
