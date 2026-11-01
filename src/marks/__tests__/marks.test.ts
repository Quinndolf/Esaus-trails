import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMarks, filterMarks, countByKind } from '../model';
import { useUndoDeletes, UNDO_MS } from '../undo';
import { holdDragDecision, HOLD_MS, MOVE_SLOP_PX } from '../holdDrag';

const wp = (id: string, name: string, createdAt: string, icon = 'x') =>
  ({ id, name, icon, notes: '', position: [-85.5, 37.5], altitude: null, photoIds: [], createdAt, updatedAt: createdAt }) as any;
const pin = (id: string, name: string, createdAt: string) =>
  ({ id, photoId: 'p', name, notes: 'oak', tags: ['rub'], position: { lng: -85.4, lat: 37.4 }, createdAt }) as any;
const track = { id: 't1', name: 'Creek route', points: [{ lngLat: [-85.5, 37.5] }, { lngLat: [-85.51, 37.51] }], startedAt: 0, endedAt: 48 * 60e3, distance: 1930 } as any;
const shape = { id: 's1', name: 'Corn field edge', kind: 'area', points: [[-85.5, 37.5], [-85.5, 37.51], [-85.49, 37.51]], notes: '', createdAt: '2026-10-30T10:00:00Z' } as any;

const items = () =>
  buildMarks({
    waypoints: [wp('w1', 'Tree stand', '2026-10-31T12:00:00Z', 'stand'), wp('w2', 'Marked 6:40 PM', '2026-11-01T12:00:00Z')],
    pins: [pin('p1', 'Rub on the oak', '2026-10-31T13:00:00Z')],
    tracks: [track],
    shapes: [shape],
  });

describe('marks model', () => {
  it('merges everything into one list, newest first, with positions to jump to', () => {
    const list = items();
    expect(list).toHaveLength(5);
    expect(list[0].id).toBe('w2');
    expect(list.find((m) => m.id === 'p1')!.points).toEqual([[-85.4, 37.4]]);
    expect(list.find((m) => m.id === 't1')!.kind).toBe('track');
  });

  it('filters by kind (shapes ride with tracks) and by search text in name, notes and tags', () => {
    const list = items();
    expect(filterMarks(list, 'photo', '').map((m) => m.id)).toEqual(['p1']);
    expect(filterMarks(list, 'track', '').map((m) => m.id).sort()).toEqual(['s1', 't1']);
    expect(filterMarks(list, 'all', 'RUB').map((m) => m.id)).toEqual(['p1']);
    expect(filterMarks(list, 'waypoint', 'tree').map((m) => m.id)).toEqual(['w1']);
    expect(filterMarks(list, 'all', 'zzz')).toEqual([]);
  });

  it('counts per filter chip', () => {
    expect(countByKind(items())).toEqual({ all: 5, waypoint: 2, photo: 1, track: 2 });
  });
});

describe('delete with undo', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    useUndoDeletes.setState({ pending: {} });
  });

  it('hides at once, deletes after 5 seconds', () => {
    const commit = vi.fn();
    useUndoDeletes.getState().schedule('w1', 'Tree stand', commit);
    expect(useUndoDeletes.getState().pending['w1']).toBeTruthy();
    vi.advanceTimersByTime(UNDO_MS - 1);
    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledOnce();
    expect(useUndoDeletes.getState().pending['w1']).toBeUndefined();
  });

  it('undo cancels the delete', () => {
    const commit = vi.fn();
    useUndoDeletes.getState().schedule('w1', 'Tree stand', commit);
    useUndoDeletes.getState().undo('w1');
    vi.advanceTimersByTime(UNDO_MS * 2);
    expect(commit).not.toHaveBeenCalled();
    expect(useUndoDeletes.getState().pending['w1']).toBeUndefined();
  });
});

describe('press-and-hold drag', () => {
  it('starts a drag only after the hold with a still finger', () => {
    expect(holdDragDecision({ heldMs: HOLD_MS, movedPx: 0 })).toBe('drag');
    expect(holdDragDecision({ heldMs: HOLD_MS - 1, movedPx: 0 })).toBe('wait');
  });
  it('cancels when the finger moves before the hold (it is a map pan or a tap)', () => {
    expect(holdDragDecision({ heldMs: 100, movedPx: MOVE_SLOP_PX + 1 })).toBe('cancel');
    expect(holdDragDecision({ heldMs: 100, movedPx: MOVE_SLOP_PX })).toBe('wait');
  });
});
