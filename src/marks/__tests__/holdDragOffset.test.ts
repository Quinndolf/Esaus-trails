// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { attachHoldDrag, HOLD_MS } from '../holdDrag';

/** A flat fake map: 1 px = 0.001 degree, canvas at the page origin. */
function fakeMap() {
  return {
    getCanvas: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }),
    unproject: ([x, y]: [number, number]) => ({ lng: x / 1000, lat: -y / 1000 }),
    project: (ll: { lng: number; lat: number }) => ({ x: ll.lng * 1000, y: -ll.lat * 1000 }),
    dragPan: { enable: vi.fn(), disable: vi.fn() },
  };
}

describe('hold-drag', () => {
  it('a long press without moving does not move the marker, even when the pin sits above the fingertip', () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    document.body.appendChild(el);
    let at = { lng: 0.2, lat: -0.1 }; // marker tip at pixel (200, 100)
    const marker = { getElement: () => el, getLngLat: () => at, setLngLat: (l: [number, number]) => void (at = { lng: l[0], lat: l[1] }) };
    const commit = vi.fn();
    attachHoldDrag(fakeMap() as never, marker as never, commit);
    const ev = (type: string, x: number, y: number) => new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    // finger lands 30 px below the marker tip (on the pin's body)
    el.dispatchEvent(Object.assign(ev('pointerdown', 200, 130), { pointerId: 1 }));
    vi.advanceTimersByTime(HOLD_MS + 50);
    el.dispatchEvent(Object.assign(ev('pointerup', 200, 130), { pointerId: 1 }));
    expect(commit).toHaveBeenCalledTimes(1);
    const [to] = commit.mock.calls[0]!;
    expect(to[0]).toBeCloseTo(0.2, 6);
    expect(to[1]).toBeCloseTo(-0.1, 6);
    vi.useRealTimers();
  });
});
