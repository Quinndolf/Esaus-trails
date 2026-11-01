# Ginseng "Where to look" guide: design

Status: proposed, for review. No code yet.

## Why
The ginseng mode today covers the rules (`src/ginseng/rules.ts`) and seven how-to slides about digging and selling. It does not teach a beginner where to look. Quinn is a brand-new hunter, so the missing lesson is "what ground and what plants say sang might be here."

## What it adds
A new "Where to look" group of 4 slides at the front of the ginseng how-to. Slides:

1. **Slope and aspect:** mid-slope and base of slope beat ridge tops; north- and east-facing slopes are cooler and moister.
2. **Shade and trees:** heavy shade, about 90 percent; tulip-poplar and black walnut give dense shade; sugar maple is a good neighbor because it supplies calcium.
3. **Soil and water:** moist but well-drained, lots of leaf litter; heavy clay or sand does worse; ginseng wants calcium.
4. **Companion plants:** if you see goldenseal, ginseng may be near, and so may mayapple and wild ginger. These are clues, not proof.

All facts come from University of Kentucky Cooperative Extension publication FOR91 (https://publications.ca.uky.edu/sites/publications.ca.uky.edu/files/FOR91.pdf), which is cited on the slides. The publication does not cover plant identification, so the existing "Know a mature plant" slide stays the source for that.

## Habitat score: not added
On reading the code, ginseng mode already has a sourced habitat model (`src/ginseng/model.ts`: aspect, slope, position, moisture, canopy, with citations) and a map shading. A second score would duplicate it, so this change adds only the four teaching slides and the FOR91 citation.

## Rules kept
- Free sources only, no new services.
- Public land and season rules stay exactly as in `rules.ts`; the guide links to them and never tells anyone to dig out of season.
- No photos or marks leave the phone.

## Not in scope
Plant identification photos, selling and dealer details (already covered), other medicinals.

## Testing
A test that the four habitat slides come first, carry the key facts and say they are clues not proof, that the sources list includes FOR91, and that the sheet now steps through 11 slides.
