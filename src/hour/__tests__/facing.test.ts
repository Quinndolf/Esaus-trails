import { describe, expect, it } from 'vitest';
import { trailsInView } from '../facing';
import { stepYards } from '../../model/geo';

const O: [number, number] = [-85.5, 37.5];
const trail = (pts: [number, number][], weight = 1) => ({ coordinates: pts, weight });

describe('trails in the direction you face', () => {
  it('keeps the part of a trail ahead of you and within range', () => {
    const ahead = trail([stepYards(O, 0, 40), stepYards(O, 0, 120), stepYards(O, 0, 200)]);
    const fc = trailsInView([ahead], O, 0);
    expect(fc.features.length).toBe(2); // both segments are ahead
  });

  it('drops trails behind you, off to the side, or too far', () => {
    const behind = trail([stepYards(O, 180, 40), stepYards(O, 180, 120)]);
    const side = trail([stepYards(O, 90, 40), stepYards(O, 90, 120)]);
    const far = trail([stepYards(O, 0, 700), stepYards(O, 0, 800)]);
    expect(trailsInView([behind, side, far], O, 0).features).toEqual([]);
  });

  it('turns with the heading', () => {
    const east = trail([stepYards(O, 90, 40), stepYards(O, 90, 120)]);
    expect(trailsInView([east], O, 90).features.length).toBe(1);
    expect(trailsInView([east], O, 0).features.length).toBe(0);
  });

  it('works across north (359 degrees facing a 5 degree trail)', () => {
    const t = trail([stepYards(O, 5, 40), stepYards(O, 5, 120)]);
    expect(trailsInView([t], O, 359).features.length).toBe(1);
  });
});
