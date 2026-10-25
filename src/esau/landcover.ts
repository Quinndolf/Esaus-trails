/** NLCD 2021 land cover classes and USDA CDL crop codes, with what they mean to game. */

export interface CoverClass {
  name: string;
  /** Rough canopy closure 0-1. */
  canopy: number;
  woody: boolean;
  open: boolean;
  water: boolean;
  developed: boolean;
}

const C = (name: string, canopy: number, flags: Partial<Omit<CoverClass, "name" | "canopy">> = {}): CoverClass => ({
  name,
  canopy,
  woody: false,
  open: false,
  water: false,
  developed: false,
  ...flags,
});

export const NLCD: Record<number, CoverClass> = {
  11: C("open water", 0, { water: true }),
  12: C("ice or snow", 0, { open: true }),
  21: C("developed open space (yards, parks)", 0.12, { open: true, developed: true }),
  22: C("low-density development", 0.08, { open: true, developed: true }),
  23: C("medium-density development", 0.04, { open: true, developed: true }),
  24: C("high-density development", 0.02, { open: true, developed: true }),
  31: C("barren ground", 0.02, { open: true }),
  41: C("deciduous forest", 0.72, { woody: true }),
  42: C("evergreen forest", 0.84, { woody: true }),
  43: C("mixed forest", 0.76, { woody: true }),
  52: C("shrub and young growth", 0.34, { woody: true }),
  71: C("grassland", 0.08, { open: true }),
  81: C("pasture or hay", 0.14, { open: true }),
  82: C("cultivated crops", 0.06, { open: true }),
  90: C("woody wetland", 0.66, { woody: true }),
  95: C("emergent herbaceous wetland", 0.1, {}),
};

const UNKNOWN = C("unclassified", 0.2);

export function coverClass(code: number): CoverClass {
  return NLCD[code] ?? UNKNOWN;
}

export interface CropClass {
  name: string;
  /** Whitetail food draw 0-1 in season (the prototype's numbers). */
  food: number;
}

export const CDL: Record<number, CropClass> = {
  1: { name: "corn", food: 1 },
  4: { name: "sorghum", food: 0.9 },
  5: { name: "soybeans", food: 0.95 },
  21: { name: "barley", food: 0.75 },
  24: { name: "winter wheat", food: 0.85 },
  26: { name: "wheat double-cropped with soybeans", food: 0.9 },
  27: { name: "rye", food: 0.7 },
  28: { name: "oats", food: 0.75 },
  36: { name: "alfalfa", food: 0.88 },
  37: { name: "hay", food: 0.62 },
  59: { name: "sod or grass seed", food: 0.3 },
  61: { name: "fallow or idle cropland", food: 0.35 },
  176: { name: "pasture", food: 0.38 },
  205: { name: "triticale", food: 0.75 },
  225: { name: "winter wheat then corn", food: 0.9 },
  236: { name: "winter wheat then sorghum", food: 0.88 },
  241: { name: "corn and soybeans", food: 0.95 },
};

export function cropClass(code: number): CropClass | null {
  if (!code) return null;
  return CDL[code] ?? null;
}

/** Food score of a cell for deer: rich crops, or NLCD cultivated ground with no CDL detail. */
export function foodScore(cover: number, crop: number): number {
  const c = cropClass(crop);
  if (c) return c.food;
  if (cover === 82) return 0.72;
  if (cover === 81) return 0.45;
  return 0;
}
