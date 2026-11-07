import { beforeEach, describe, expect, it } from 'vitest';
import type { EsauReply, SpotQuery } from '../../types';
import { hollowGrid } from '../../fixtures/hollow';
import { clearReplies, recallReply, rememberReply, REUSE_MS } from '../replyCache';

const grid = hollowGrid();
const q = (over: Partial<SpotQuery> = {}): SpotQuery => ({
  species: 'whitetail',
  weapon: 'bow',
  spot: { lat: 36.75, lng: -85.7 },
  grid,
  hourIndex: 2,
  timeZone: 'America/Chicago',
  ...over,
});
const reply = (servedBy = 'claude'): EsauReply =>
  ({ say: 'Sit here.', more: '', headline: 'h', confidence: 'fair', spotRole: 'travel', marks: [], wouldChangeMyMind: [], meta: { model: 'm', servedBy, inputTokens: 1, outputTokens: 1, ms: 1 } }) as EsauReply;
const T0 = 1_000_000;

beforeEach(() => clearReplies());

describe('reply cache for repeat taps', () => {
  it('gives back the same answer for a tap within about 30 yd, same hour, animal and weapon', () => {
    const r = reply();
    rememberReply(q(), r, T0);
    expect(recallReply(q({ spot: { lat: 36.75015, lng: -85.7 } }), T0 + 60_000)).toBe(r); // ~18 yd north
  });
  it('asks again for a tap farther away', () => {
    rememberReply(q(), reply(), T0);
    expect(recallReply(q({ spot: { lat: 36.7505, lng: -85.7 } }), T0)).toBeNull(); // ~60 yd
  });
  it('asks again for another hour, animal or weapon', () => {
    rememberReply(q(), reply(), T0);
    expect(recallReply(q({ hourIndex: 3 }), T0)).toBeNull();
    expect(recallReply(q({ species: 'squirrel' }), T0)).toBeNull();
    expect(recallReply(q({ weapon: 'crossbow' }), T0)).toBeNull();
  });
  it('asks again when the sit spots changed or the wide read arrived', () => {
    rememberReply(q(), reply(), T0);
    const spot = { rank: 1, lat: 36.75, lng: -85.7, watchBearingDeg: 90, yardsToTrail: 20, reason: 'r' };
    expect(recallReply(q({ sitSpots: [spot] }), T0)).toBeNull();
    expect(recallReply(q({ wider: ['WIDER COUNTRY'] }), T0)).toBeNull();
  });
  it('asks again when the hunter moved', () => {
    rememberReply(q({ hunter: { lat: 36.74, lng: -85.71 } }), reply(), T0);
    expect(recallReply(q({ hunter: { lat: 36.76, lng: -85.71 } }), T0)).toBeNull();
  });
  it('forgets after half an hour', () => {
    rememberReply(q(), reply(), T0);
    expect(recallReply(q(), T0 + REUSE_MS + 1)).toBeNull();
  });
  it('never reuses an answer to a question, or keeps an offline fallback', () => {
    rememberReply(q({ question: 'where do I sit?' }), reply(), T0);
    expect(recallReply(q(), T0)).toBeNull();
    rememberReply(q(), reply('offline-rules'), T0);
    expect(recallReply(q(), T0)).toBeNull();
    rememberReply(q(), reply(), T0);
    expect(recallReply(q({ question: 'why?' }), T0)).toBeNull();
  });
  it('asks again on new ground for the same spot', () => {
    rememberReply(q(), reply(), T0);
    const other = { ...grid, weather: { ...grid.weather, hours: grid.weather.hours.map((h) => ({ ...h, at: new Date(Date.parse(h.at) + 86_400_000).toISOString() })) } };
    expect(recallReply(q({ grid: other }), T0)).toBeNull();
  });
});
