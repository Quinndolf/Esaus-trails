import { angleDiff, bearingVector, clamp, normalizeBearing, smoothstep, vectorBearing } from './geo';
import type { Terrain } from './terrain';
import type { WeatherHour } from './types';

/**
 * Wind as it reaches each cell. The forecast is one number for a 2.5 km square;
 * the ground bends it:
 *
 * - Ridges and knobs catch more of it, hollows and bottoms less.
 * - The lee side of a steep slope is sheltered and, in a real wind, eddies:
 *   scent there can curl back upslope against the forecast direction.
 * - Draws and creek bottoms channel it along their length.
 * - Timber slows it near the ground.
 */
export interface WindField {
  /** Direction wind comes FROM at each cell. */
  fromDeg: Float32Array;
  /** 10 m-equivalent speed at each cell, mph. */
  mph: Float32Array;
  /** 1 where the cell is in the lee of its own slope. */
  sheltered: Uint8Array;
  /** 1 where the lee is steep and the wind strong enough to roll over and eddy. */
  eddy: Uint8Array;
}

export function computeWind(t: Terrain, weather: WeatherHour): WindField {
  const n = t.slopeDeg.length;
  const fromDeg = new Float32Array(n);
  const mph = new Float32Array(n);
  const sheltered = new Uint8Array(n);
  const eddy = new Uint8Array(n);
  const downwind = normalizeBearing(weather.windFrom + 180);

  for (let i = 0; i < n; i++) {
    const slope = t.slopeDeg[i];
    const aspect = t.aspectDeg[i];
    const pos = t.position[i];
    let m = pos >= 0 ? 1 + 0.35 * pos : 1 + 0.45 * pos;
    let toward = downwind;

    if (Number.isFinite(aspect) && slope > 6) {
      const lee = angleDiff(aspect, downwind);
      const steep = smoothstep(6, 25, slope);
      if (lee < 70) {
        const f = 1 - 0.5 * steep * (1 - lee / 70);
        m *= f;
        if (f < 0.82) sheltered[i] = 1;
        if (slope > 18 && lee < 45 && weather.windMph >= 8) eddy[i] = 1;
      } else if (lee > 110) {
        m *= 1 + 0.15 * steep * ((lee - 110) / 70);
      }
    }

    // Channeling: in a draw the wind turns to run along it, whichever way is closer to downwind.
    if (t.drainage[i] > 0.5 && pos < -0.15 && Number.isFinite(aspect)) {
      const axis = angleDiff(aspect, downwind) <= 90 ? aspect : normalizeBearing(aspect + 180);
      const w = 0.35 * clamp((t.drainage[i] - 0.5) / 0.5, 0, 1) + 0.1;
      const [de, dn] = bearingVector(toward, 1 - w);
      const [ae, an] = bearingVector(axis, w);
      toward = vectorBearing(de + ae, dn + an);
    }

    m *= 1 - 0.35 * (t.canopyPct[i] / 100);
    fromDeg[i] = normalizeBearing(toward + 180);
    mph[i] = Math.max(0, weather.windMph * clamp(m, 0.3, 1.5));
  }
  return { fromDeg, mph, sheltered, eddy };
}
