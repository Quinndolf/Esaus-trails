// Fake data so a screenshot run needs no internet, no server and no API key.
// Terrain is a made-up ridge-and-hollow near Richmond, KY. It is NOT real ground.
import { PNG } from 'pngjs';

export const SPOT = { lat: 37.85, lng: -84.27 };

/** A 256px placeholder map tile: soft green/brown noise so the map looks like land. */
export function tilePng(kind) {
  const png = new PNG({ width: 256, height: 256 });
  const base = kind === 'topo' ? [233, 226, 205] : [58, 78, 46];
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const n = Math.sin(x / 19) * Math.cos(y / 23) * 14 + Math.sin((x + y) / 41) * 10;
      const i = (y * 256 + x) * 4;
      png.data[i] = Math.max(0, base[0] + n);
      png.data[i + 1] = Math.max(0, base[1] + n * 1.2);
      png.data[i + 2] = Math.max(0, base[2] + n * 0.6);
      png.data[i + 3] = 255;
    }
  return PNG.sync.write(png);
}

/** A believable /api/ground answer: a ridge with a hollow, oak-hickory timber, one corn field. */
export function groundGrid(url) {
  const q = url.searchParams;
  const lat = Number(q.get('lat') ?? SPOT.lat), lng = Number(q.get('lng') ?? SPOT.lng);
  const west = Number(q.get('west') ?? lng - 0.03), east = Number(q.get('east') ?? lng + 0.03);
  const south = Number(q.get('south') ?? lat - 0.022), north = Number(q.get('north') ?? lat + 0.022);
  const cols = Number(q.get('cols') ?? 32), rows = Number(q.get('rows') ?? 32);
  const elevationM = [], cover = [], crop = [], greenness = [], forestType = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = c / cols, y = r / rows;
      elevationM.push(280 + 60 * Math.sin(x * 5) * Math.cos(y * 4) + 25 * x);
      const field = x > 0.65 && y > 0.55;
      cover.push(field ? 82 : 41);
      crop.push(field ? 1 : 0);
      greenness.push(field ? 55 : 70);
      forestType.push(field ? 0 : 500);
    }
  const now = new Date(); now.setMinutes(0, 0, 0);
  const hours = Array.from({ length: 48 }, (_, k) => {
    const at = new Date(now.getTime() + k * 3600e3);
    return { at: at.toISOString(), tempF: 48 + 12 * Math.sin(((at.getHours() - 9) / 24) * 2 * Math.PI), windMph: 6 + (k % 5), windFrom: 250 + (k % 7) * 4, gustMph: 12, skyCover: 30, precipChance: 10, pressureInHg: 30.02 };
  });
  return { west, south, east, north, cols, rows, elevationM, cover, crop, greenness, forestType, weather: { source: 'preview fixture', hours }, notes: ['Preview data: made-up terrain, not a real read.'] };
}
