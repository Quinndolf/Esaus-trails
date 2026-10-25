import type { GroundGrid, WeatherHour } from "../types";

/**
 * A synthetic 32x32 Kentucky-style hollow, about 1.0 x 0.9 miles, for tests and sample spots.
 *
 * - An east-west ridge across the north third, 300 ft above the creek, with a low saddle near col 16.
 * - A finger ridge runs south off the main ridge at col 8 and ends in a point.
 * - A bench (flat shelf) on the south face of the main ridge around cols 22-28.
 * - A creek runs east-west along row 27; its bottom is a soybean field from col 14 east, timber elsewhere.
 * - A small pond at the field's east end; cedar thicket (evergreen) on the east end of the bench.
 */
export function hollowGrid(opts: { start?: string; windFrom?: number; windMph?: number; tempF?: number } = {}): GroundGrid {
  const rows = 32, cols = 32;
  const west = -84.3, east = -84.282, north = 37.7, south = 37.687;
  const elevationM: number[] = [];
  const cover: number[] = [];
  const crop: number[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Main ridge crest at row 6, falls to the creek at row 27 and gently north off the crest.
      // South face drops ~11 m per 45 m row (about 14 degrees); the north side falls away gentler.
      const crest = 330;
      const southDrop = (rr: number) => {
        // Steep face with a flat shelf (the bench) on rows 11-12 from col 21 east.
        let d = 0;
        for (let k = 7; k <= rr; k++) d += c >= 21 && c <= 29 && (k === 11 || k === 12) ? 0.8 : 11;
        return d;
      };
      let e = r <= 6 ? crest - (6 - r) * 7 : crest - southDrop(Math.min(r, 25));
      // Saddle: a gentle dip in the crest centred on col 16.
      e -= 9 * Math.exp(-((c - 16) ** 2) / 5) * Math.exp(-((r - 6) ** 2) / 3);
      // Finger ridge down col 8, fading out by row 19.
      if (r > 6 && r < 20) e += 60 * Math.exp(-((c - 8) ** 2) / 4) * Math.max(0, 1 - (r - 6) / 13);
      // Creek bottom: flat floor rows 25-28, then rising again to the south.
      const floor = crest - southDrop(25) - c * 0.12;
      if (r >= 25) e = r <= 28 ? floor + Math.abs(r - 27) * 0.4 : floor + (r - 28) * 6;
      elevationM.push(Math.round(e * 10) / 10);

      let cv = 41; // deciduous
      let cp = 0;
      if (r >= 25 && r <= 29 && c >= 14) {
        cv = 82;
        cp = 5; // soybeans
      }
      if (r === 27 && c < 14) cv = 90; // woody wetland along the creek in the timber
      if (r >= 26 && r <= 28 && c >= 29) cv = 11; // pond
      if (r >= 10 && r <= 14 && c >= 26 && c <= 30) cv = 42; // cedar thicket on the bench's east end
      if (r >= 30) cv = 52; // shrubby regrowth along the south edge
      cover.push(cv);
      crop.push(cp);
    }
  }

  const start = new Date(opts.start ?? "2026-11-08T11:00:00Z"); // 5 am Central
  const hours: WeatherHour[] = [];
  for (let h = 0; h < 24; h++) {
    const at = new Date(start.getTime() + h * 36e5);
    const daylight = h >= 2 && h <= 11;
    hours.push({
      at: at.toISOString(),
      tempF: (opts.tempF ?? 34) + (daylight ? Math.sin(((h - 2) / 9) * Math.PI) * 18 : 0),
      windMph: (opts.windMph ?? 7) + (daylight ? 3 : 0),
      windFrom: opts.windFrom ?? 315,
    });
  }

  return {
    west, east, south, north, cols, rows, elevationM, cover, crop,
    weather: { source: "synthetic", hours },
    notes: ["Synthetic test ground."],
  };
}

/** Cell centre of the hollow grid, for placing taps on known features. */
export function cell(r: number, c: number): { lat: number; lng: number } {
  const west = -84.3, east = -84.282, north = 37.7, south = 37.687;
  return { lat: north - ((r + 0.5) / 32) * (north - south), lng: west + ((c + 0.5) / 32) * (east - west) };
}
