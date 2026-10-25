// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { distance, formatArea, formatDistance, formatDuration, polygonArea, type LngLat } from '../../map/geo';
import { getPhoto, _resetDbForTests } from '../../photos/photoDb';
import { _resetToolsDbForTests } from '../db';
import { isToolCapturingTaps, useTools } from '../store';

const HOME: LngLat = [-85.3, 37.6];

beforeEach(async () => {
  await _resetToolsDbForTests();
  await _resetDbForTests();
  useTools.setState({ loaded: false, waypoints: [], shapes: [], tracks: [], mode: 'none', draft: [], selectedWaypointId: null, recording: null });
});

describe('measuring math', () => {
  it('measures a degree of latitude and a 100 m square', () => {
    expect(distance([0, 0], [0, 1]) / 1000).toBeCloseTo(111.2, 0);
    // ~100 m on a side near Kentucky: about 2.47 acres.
    const dLat = 100 / 111195;
    const dLng = 100 / (111195 * Math.cos((37.6 * Math.PI) / 180));
    const sq: LngLat[] = [HOME, [HOME[0] + dLng, HOME[1]], [HOME[0] + dLng, HOME[1] + dLat], [HOME[0], HOME[1] + dLat]];
    expect(polygonArea(sq)).toBeGreaterThan(9900);
    expect(polygonArea(sq)).toBeLessThan(10100);
    expect(formatArea(polygonArea(sq))).toBe('2.5 ac');
  });

  it('formats like a hunter reads it', () => {
    expect(formatDistance(100)).toBe('109 yd');
    expect(formatDistance(3218.7)).toBe('2.00 mi');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });
});

describe('waypoints', () => {
  it('marks a red X, edits it and survives a reload', async () => {
    const wp = await useTools.getState().addWaypoint({ position: HOME, altitude: 250 });
    expect(wp.icon).toBe('x');
    expect(useTools.getState().selectedWaypointId).toBe(wp.id);
    await useTools.getState().updateWaypoint(wp.id, { name: 'Ridge stand', icon: 'stand', notes: 'NW wind only' });
    useTools.setState({ waypoints: [] });
    await useTools.getState().load();
    expect(useTools.getState().waypoints[0]).toMatchObject({ name: 'Ridge stand', icon: 'stand', notes: 'NW wind only', altitude: 250 });
  });

  it('attaches photos in the shared photo store and cleans them up on delete', async () => {
    const wp = await useTools.getState().addWaypoint({ position: HOME });
    await useTools.getState().addWaypointPhoto(wp.id, new File(['jpg'], 'rub.jpg', { type: 'image/jpeg' }));
    const [photoId] = useTools.getState().waypoints[0].photoIds;
    expect(await getPhoto(photoId)).toBeTruthy();
    await useTools.getState().removeWaypoint(wp.id);
    expect(useTools.getState().waypoints).toHaveLength(0);
    expect(await getPhoto(photoId)).toBeUndefined();
  });

  it('drops a waypoint with a map tap and leaves tap mode', async () => {
    useTools.getState().setMode('drop-waypoint');
    expect(isToolCapturingTaps()).toBe(true);
    await useTools.getState().tapMap(HOME);
    expect(useTools.getState().waypoints[0].position).toEqual(HOME);
    expect(isToolCapturingTaps()).toBe(false);
  });
});

describe('draw and measure', () => {
  it('needs 3 points for an area and saves it named', async () => {
    const s = useTools.getState();
    s.setMode('draw-area');
    await s.tapMap([-85.3, 37.6]);
    await s.tapMap([-85.299, 37.6]);
    expect(await useTools.getState().saveDraft()).toBeNull();
    await useTools.getState().tapMap([-85.299, 37.601]);
    const shape = await useTools.getState().saveDraft('Bean field');
    expect(shape).toMatchObject({ kind: 'area', name: 'Bean field' });
    expect(useTools.getState().mode).toBe('none');
  });

  it('undo drops the last point', async () => {
    const s = useTools.getState();
    s.setMode('measure');
    await s.tapMap([0, 0]);
    await s.tapMap([0, 1]);
    useTools.getState().undoPoint();
    expect(useTools.getState().draft).toEqual([[0, 0]]);
  });
});

describe('tracker', () => {
  it('records good fixes, skips jitter and poor accuracy, and saves the route', async () => {
    useTools.getState().startTrack();
    const step = 50 / 111195; // 50 m north per fix
    const add = useTools.getState().addFix;
    add({ lngLat: [-85.3, 37.6], accuracy: 5, altitude: null, time: 1 });
    add({ lngLat: [-85.3, 37.6 + step / 50], accuracy: 5, altitude: null, time: 2 }); // 1 m: jitter
    add({ lngLat: [-85.3, 37.6 + step], accuracy: 80, altitude: null, time: 3 }); // poor fix
    add({ lngLat: [-85.3, 37.6 + step], accuracy: 6, altitude: null, time: 4 });
    add({ lngLat: [-85.3, 37.6 + 2 * step], accuracy: 6, altitude: null, time: 5 });
    expect(useTools.getState().recording!.points).toHaveLength(3);
    const track = await useTools.getState().stopTrack();
    expect(track!.distance).toBeGreaterThan(99);
    expect(track!.distance).toBeLessThan(101);
    expect(useTools.getState().tracks).toHaveLength(1);
    expect(useTools.getState().recording).toBeNull();
  });

  it('drops a route with fewer than two points', async () => {
    useTools.getState().startTrack();
    expect(await useTools.getState().stopTrack()).toBeNull();
  });
});
