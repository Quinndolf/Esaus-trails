import { describe, expect, it } from 'vitest';
import { buildBrief } from '../../esau/brief';
import { hollowGrid } from '../../esau/fixtures/hollow';
import { buildSystemPrompt } from '../../esau/persona';
import { offlineRead } from '../../esau/offline';
import { ginseng } from '../../esau/species/ginseng';
import { speciesBrain, SPECIES } from '../../esau/species';
import { aspectFactor, ginsengClass, ginsengFactors, ginsengField, ginsengPixels, slopeFactor, type Site } from '../model';
import { KY_GINSENG_RULES, seasonStatus } from '../rules';

const cove: Site = { aspectDeg: 30, slopeDeg: 15, coverCode: 41, position: -0.25, drainage: 0.3 };

describe('ginseng habitat factors', () => {
  it('favors north and east faces over south and west', () => {
    const f = (a: number) => aspectFactor(a, 15);
    expect(f(30)).toBeGreaterThan(f(0) - 0.01);
    expect(f(30)).toBeGreaterThan(f(90));
    expect(f(90)).toBeGreaterThan(f(270));
    expect(f(0)).toBeGreaterThan(f(180) + 0.5);
    expect(aspectFactor(null, 0)).toBeCloseTo(0.45);
  });
  it('wants moderate slopes: not flat, not cliffs', () => {
    expect(slopeFactor(14)).toBeCloseTo(1, 1);
    expect(slopeFactor(0.5)).toBeLessThan(0.45);
    expect(slopeFactor(38)).toBeLessThan(0.3);
  });
  it('ranks a northeast hardwood cove above a south-facing oak-free ridge, a field and a conifer stand', () => {
    const best = ginsengFactors(cove).score;
    const southRidge = ginsengFactors({ aspectDeg: 190, slopeDeg: 20, coverCode: 41, position: 0.8, drainage: 0.02 }).score;
    const field = ginsengFactors({ ...cove, coverCode: 81 }).score;
    const pine = ginsengFactors({ ...cove, coverCode: 42 }).score;
    const channel = ginsengFactors({ aspectDeg: 30, slopeDeg: 1, coverCode: 41, position: -0.9, drainage: 0.9 }).score;
    expect(best).toBeGreaterThan(0.8);
    expect(ginsengClass(best)).toBe('high');
    for (const s of [southRidge, field, pine, channel]) expect(s).toBeLessThan(best - 0.3);
    expect(ginsengClass(field)).toBe('poor');
  });
  it('scores a whole grid and draws only fair ground and better', () => {
    const f = ginsengField(hollowGrid());
    expect(f.score.length).toBe(32 * 32);
    const px = ginsengPixels(f.score);
    let drawn = 0;
    for (let i = 0; i < f.score.length; i++) if (px[i * 4 + 3] > 0) drawn++;
    expect(drawn).toBe(Array.from(f.score).filter((v) => v >= 0.3).length);
    expect(Math.max(...f.score)).toBeLessThanOrEqual(1);
  });
});

describe('Kentucky season', () => {
  it('opens Sept 1 and closes Dec 1', () => {
    expect(seasonStatus(new Date(2026, 7, 31, 12)).open).toBe(false);
    expect(seasonStatus(new Date(2026, 8, 1, 12)).open).toBe(true);
    const oct = seasonStatus(new Date(2026, 9, 25, 12));
    expect(oct.open).toBe(true);
    expect(oct.days).toBe(37);
    expect(seasonStatus(new Date(2026, 11, 1, 12)).open).toBe(true);
    expect(seasonStatus(new Date(2026, 11, 2, 12)).open).toBe(false);
    expect(seasonStatus(new Date(2026, 11, 2, 12)).text).toMatch(/opens Sep 1/);
  });
  it('lists the rules a digger must hear', () => {
    const all = KY_GINSENG_RULES.map((r) => r.body.toLowerCase()).join(' ');
    for (const need of ['december 1', 'five years', 'three', '50 feet', 'permission', 'state parks']) expect(all).toContain(need);
  });
});

describe('Esau in ginseng mode', () => {
  it('is a listed species with its own persona, not the hunting one', () => {
    expect(SPECIES.map((s) => s.id)).toContain('ginseng');
    const sys = buildSystemPrompt(speciesBrain('ginseng')!);
    expect(sys).toMatch(/dig sang/);
    expect(sys).not.toMatch(/carry the rifle/);
    expect(sys).toMatch(/September 1 to December 1/);
    expect(sys).toMatch(/\[osuF58\]/);
    expect(buildSystemPrompt(speciesBrain('whitetail')!)).not.toMatch(/dig sang/);
    for (const key of ['anderson02', 'osuF58', 'sheban21', 'kar', 'kda']) expect(ginseng.sources[key]).toBeTruthy();
  });
  it('builds a field report with the ginseng ground, the season, and no scent talk', () => {
    const b = buildBrief({ species: 'ginseng', spot: { lat: 37.5, lng: -85.5 }, grid: hollowGrid() });
    expect(b.report).toMatch(/GINSENG GROUND/);
    expect(b.report).toMatch(/Kentucky season today/);
    expect(b.report).toMatch(/Wind and thermals do not matter/);
    expect(b.report).not.toMatch(/ROUGH SCORES/);
    expect(b.report).not.toMatch(/scent carries toward/);
  });
  it('gives an honest short read with no signal', () => {
    const b = buildBrief({ species: 'ginseng', spot: { lat: 37.5, lng: -85.5 }, grid: hollowGrid() });
    const r = offlineRead(b);
    expect(['good ground', 'fair ground', 'poor ground']).toContain(r.spotRole);
    expect(r.say).toMatch(/tulip-poplar|season|Season/);
  });
});
