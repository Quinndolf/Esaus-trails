import { FOREST_GROUP } from "../model/food";

/**
 * Tree hints from land cover (NLCD) and, when a grid carries it, the USFS forest type group.
 * Always hedged: remote data tells us the kind of forest, not the trees at a spot.
 *
 * Finding (2026-11-02): the cloud sandbox blocks apps.fs.usda.gov and mrlc.gov (HTTP 403 from the proxy),
 * so no free keyless forest-type endpoint could be confirmed from here. Until one is, grids carry no
 * forestType and these hints come from NLCD classes alone. Fetching forestType is left as a later step.
 */
export function treeHint(cover: number, forestGroup?: number): string | null {
  if (![41, 42, 43].includes(cover)) return null;
  // The group only counts where it agrees with the cover class; otherwise the two sources conflict and we fall back to cover.
  const hardwoodish = cover === 41 || cover === 43;
  const evergreenish = cover === 42 || cover === 43;
  switch (forestGroup) {
    case FOREST_GROUP.oakHickory:
      if (!hardwoodish) break;
      return "Oak-hickory ground, so white and red oaks are likely. Look for acorns and shaggy hickory bark.";
    case FOREST_GROUP.oakPine:
    case FOREST_GROUP.oakGum:
      if (!hardwoodish) break;
      return "Oak mixed with pine or gum, so oaks are likely in the hardwood pockets.";
    case FOREST_GROUP.mapleBeech:
      if (!hardwoodish) break;
      return "Maple and beech ground, so beech nuts are likely and acorns less so.";
    case FOREST_GROUP.pine:
    case FOREST_GROUP.whitePine:
      if (!evergreenish) break;
      return "Pine ground, so little mast is likely. Look for bedding cover more than food.";
  }
  if (cover === 41) return "Hardwood forest. In Kentucky that is often oaks and hickories on the ridges, so look for acorns and nut shells to confirm.";
  if (cover === 42) return "Evergreen forest, likely pine or cedar. Little mast, but thick bedding cover.";
  return "Mixed forest, likely hardwoods with pine or cedar. Check the ground for acorns and nuts.";
}
