// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpotQuery } from '../../types';

const sent: SpotQuery[] = [];
vi.mock('../../client', () => ({
  EsauApiError: class extends Error {},
  askEsau: async (q: SpotQuery) => {
    sent.push(q);
    return { say: 'ok.', more: 'more.', headline: 'h', confidence: 'fair', spotRole: 'travel', marks: [], wouldChangeMyMind: [], meta: { model: 'm', servedBy: 'm', inputTokens: 0, outputTokens: 0, ms: 0 } };
  },
}));

import { hollowGrid } from '../../fixtures/hollow';
import { useHour } from '../../../hour/store';
import { analyzeArea, registerAnalyzer } from '../analyzeArea';
import { useEsau } from '../store';

const grid = hollowGrid();

beforeEach(() => {
  sent.length = 0;
  localStorage.clear();
  useEsau.setState({ species: 'whitetail', weapon: 'bow', sit: null, analysis: null, reply: null, spot: null, grid: null, open: false, status: 'idle', hunter: null, view: null });
  registerAnalyzer();
});

describe('weapon', () => {
  it('is remembered on the phone', () => {
    useEsau.getState().setWeapon('crossbow');
    expect(localStorage.getItem('esau-weapon')).toBe('crossbow');
  });
});

describe('analyzeArea', () => {
  it('asks the hunter to wait if the ground is not loaded yet, and sends nothing', async () => {
    useHour.setState({ grid: null, conditions: null, movement: null });
    await analyzeArea();
    expect(useEsau.getState().error).toMatch(/reading the ground/i);
    expect(sent).toHaveLength(0);
  });

  it('sends the weapon and ranked sit spots, and nothing private, once the ground is loaded', async () => {
    useHour.getState().useGrid(grid, new Date('2026-11-08T11:00:00Z'));
    await analyzeArea();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.weapon).toBe('bow');
    expect(sent[0]!.sitSpots).toBeDefined();
    expect(Object.keys(sent[0]!)).not.toContain('pins');
    expect(Object.keys(sent[0]!)).not.toContain('photo');
    expect(useEsau.getState().analysis?.legal.status).toBe('open');
  });

  it('re-reads for the new hour when the slider moves, without refetching ground', async () => {
    useHour.getState().useGrid(grid, new Date('2026-11-08T11:00:00Z'));
    await analyzeArea();
    const first = useEsau.getState().analysis!;
    const later = useHour.getState().hours[10]!;
    useHour.getState().setDate(later);
    await analyzeArea();
    expect(sent).toHaveLength(2);
    expect(sent[1]!.hourIndex).not.toBe(sent[0]!.hourIndex);
    expect(useEsau.getState().analysis).not.toBe(first);
  });

  it('picks sit spots only inside the map on screen', async () => {
    useHour.getState().useGrid(grid, new Date('2026-11-08T11:00:00Z'));
    useHour.getState().setDate(useHour.getState().hours[6]!); // midday: deer on the move in this fixture
    await analyzeArea();
    const all = useEsau.getState().analysis!.spots;
    expect(all.length).toBeGreaterThan(0);
    // Put the screen on the east half of the ground: every pick must be in it.
    const midLng = (grid.west + grid.east) / 2;
    useEsau.setState({ view: { west: midLng, east: grid.east, south: grid.south, north: grid.north } });
    await analyzeArea();
    for (const s of useEsau.getState().analysis!.spots) expect(s.lngLat[0]).toBeGreaterThanOrEqual(midLng);
    // A screen with nothing in it: no picks, and Esau says he's not sure.
    useEsau.setState({ view: { west: grid.east + 1, east: grid.east + 2, south: grid.south, north: grid.north } });
    await analyzeArea();
    expect(useEsau.getState().analysis).toMatchObject({ spots: [], unsure: true });
  });

  it('treats a map tap as where the hunter will sit', async () => {
    await useEsau.getState().tapSpot({ lat: 37.5, lng: -85.5 }).catch(() => {});
    expect(useEsau.getState().sit).toEqual({ lat: 37.5, lng: -85.5 });
  });

  it('refreshes the banners when the slider moves, and when the weapon changes', async () => {
    useHour.getState().useGrid(grid, new Date('2026-11-08T11:00:00Z'));
    await analyzeArea();
    expect(useEsau.getState().analysis?.legal.status).toBe('open');
    useEsau.getState().setWeapon('rifle'); // modern gun opens Nov 14; Nov 8 is closed for a rifle
    expect(useEsau.getState().analysis?.legal.status).toBe('closed');
    const before = useEsau.getState().analysis;
    useHour.getState().setDate(useHour.getState().hours[12]!);
    expect(useEsau.getState().analysis).not.toBe(before);
  });

  it('reads the area in view, not an old tapped spot far away, when Esau has no sit spots', async () => {
    useHour.getState().useGrid(grid, new Date('2026-11-08T11:00:00Z'));
    useEsau.setState({ species: 'elk', sit: { lat: 38.4, lng: -85.0 } }); // elk has no sit spots
    await analyzeArea();
    const s = useEsau.getState().spot!;
    expect(s.lat).toBeCloseTo((grid.north + grid.south) / 2, 4);
    expect(s.lng).toBeCloseTo((grid.west + grid.east) / 2, 4);
  });
});
