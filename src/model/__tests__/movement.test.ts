import { describe, expect, it } from 'vitest';
import type { GroundGrid } from '../../esau/types';
import { cellAt } from '../geo';
import { createMovementModel, whitetailActivity } from '../movement';
import { sunPosition } from '../sun';
import { BOX, CENTER, hour, makeGrid } from './fixtures';

/** A wooded hollow running north-south with a corn field across its south end. */
function farmHollow(): GroundGrid {
  const g = makeGrid((x, y) => 230 + Math.abs(x) * 0.25 + y * 0.04);
  const cover: number[] = [];
  const crop: number[] = [];
  for (let r = 0; r < BOX.rows; r++)
    for (let c = 0; c < BOX.cols; c++) {
      const field = r >= 26;
      cover.push(field ? 82 : 41);
      crop.push(field ? 1 : 0); // CDL 1 = corn
    }
  return { ...g, elevationM: Array.from(g.elevationM), cover, crop, weather: { source: 'test', hours: [] } };
}

const at = (iso: string) => sunPosition(new Date(iso), 37.5, -85.5);

describe('whitetail activity', () => {
  it('moves at first light, beds at midday, feeds after dark', () => {
    const dawn = whitetailActivity(at('2026-10-25T12:00:00Z'), hour(''));
    const noon = whitetailActivity(at('2026-10-25T17:30:00Z'), hour(''));
    const night = whitetailActivity(at('2026-10-25T05:00:00Z'), hour(''));
    expect(dawn.moving).toBeGreaterThan(0.45);
    expect(dawn.heading).toBe('to-bed');
    expect(noon.bedded).toBeGreaterThan(0.6);
    expect(night.feeding).toBeGreaterThan(0.45);
    expect(whitetailActivity(at('2026-10-25T22:40:00Z'), hour('')).heading).toBe('to-food');
    for (const a of [dawn, noon, night]) expect(a.bedded + a.moving + a.feeding).toBeCloseTo(1);
  });

  it('holds tighter in a hard wind', () => {
    const calm = whitetailActivity(at('2026-10-25T12:00:00Z'), hour('', { windMph: 3 }));
    const blow = whitetailActivity(at('2026-10-25T12:00:00Z'), hour('', { windMph: 25 }));
    expect(blow.moving).toBeLessThan(calm.moving);
  });
});

describe('bedding and trails', () => {
  const model = createMovementModel(farmHollow());

  it('beds in the timber off the field and runs trails from the corn to them', () => {
    const h = model.at(at('2026-10-25T17:30:00Z'), hour('', { tempF: 40 }));
    expect(h.beds.length).toBeGreaterThan(0);
    for (const b of h.beds) expect(b.lngLat[1]).toBeGreaterThan(BOX.south + (BOX.north - BOX.south) * (6 / 32)); // not in the field
    expect(h.trails.length).toBeGreaterThan(0);
    const start = h.trails[0].coordinates[0];
    expect(start[1]).toBeLessThan(BOX.south + (BOX.north - BOX.south) * (6 / 32)); // trails start on food
  });

  it('shifts presence from beds at midday to trails at dawn to the field at night', () => {
    const noon = model.at(at('2026-10-25T17:30:00Z'), hour(''));
    const night = model.at(at('2026-10-25T05:00:00Z'), hour(''));
    const bed = cellAt(model.terrain.grid, noon.beds[0].lngLat)!;
    const field = cellAt(model.terrain.grid, [CENTER[0], BOX.south + 0.0005])!;
    expect(noon.presence[bed]).toBeGreaterThan(noon.presence[field]);
    expect(night.presence[field]).toBeGreaterThan(night.presence[bed]);
    expect(noon.line).toMatch(/bedded/);
    expect(night.line).toMatch(/food/);
  });

  it('flips bedding to south faces when it turns cold', () => {
    const warm = model.at(at('2026-10-25T17:30:00Z'), hour('', { tempF: 70 }));
    const cold = model.at(at('2026-10-25T17:30:00Z'), hour('', { tempF: 25 }));
    expect(warm.bedding).not.toBe(cold.bedding);
  });
});
