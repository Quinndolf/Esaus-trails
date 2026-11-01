# Ginseng "Where to look" guide: design

Status: proposed, for review. No code yet.

## Why
The ginseng mode today covers the rules (`src/ginseng/rules.ts`) and seven how-to slides about digging and selling. It does not teach a beginner where to look. Quinn is a brand-new hunter, so the missing lesson is "what ground and what plants say sang might be here."

## What it adds
A new "Where to look" group of 4 slides at the front of the ginseng how-to, in Esau's plain voice, plus a "Habitat" row in ginseng mode that scores the tapped spot. Slides:

1. **Slope and aspect:** mid-slope and base of slope beat ridge tops; north- and east-facing slopes are cooler and moister.
2. **Shade and trees:** heavy shade, about 90 percent; tulip-poplar and black walnut give dense shade; sugar maple is a good neighbor because it supplies calcium.
3. **Soil and water:** moist but well-drained, lots of leaf litter; heavy clay or sand does worse; ginseng wants calcium.
4. **Companion plants:** if you see goldenseal, ginseng may be near, and so may mayapple and wild ginger. These are clues, not proof.

All facts come from University of Kentucky Cooperative Extension publication FOR91 (https://publications.ca.uky.edu/sites/publications.ca.uky.edu/files/FOR91.pdf), which is cited on the slides. The publication does not cover plant identification, so the existing "Know a mature plant" slide stays the source for that.

## Habitat score (small, honest)
The ginseng model already reads elevation and tree cover. Add a "habitat read" from terrain only: slope position (mid or base vs ridge) and aspect (north or east vs south or west). Output is "good", "fair" or "poor ground to scout", with the reason. It never says ginseng is present, and it says the season status from `seasonStatus` alongside.

## Rules kept
- Free sources only, no new services.
- Public land and season rules stay exactly as in `rules.ts`; the guide links to them and never tells anyone to dig out of season.
- No photos or marks leave the phone.

## Not in scope
Plant identification photos, selling and dealer details (already covered), other medicinals.

## Testing
Unit tests for the habitat read (ridge vs base, aspect cases, unknown terrain returns "no read"); a render test that the 4 new slides appear first and cite FOR91.

## Open choice
Whether the habitat read appears on the map tap panel or only inside ginseng mode. Default: only inside ginseng mode.
