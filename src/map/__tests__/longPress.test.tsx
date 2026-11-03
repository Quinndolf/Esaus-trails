// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useLongPress } from '../useLongPress';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const tap = vi.fn();
const long = vi.fn();
function Btn() {
  return createElement('button', useLongPress(tap, long), 'go');
}
const fire = (el: Element, type: string) => act(() => void el.dispatchEvent(new Event(type, { bubbles: true })));

beforeEach(() => {
  vi.useFakeTimers();
  tap.mockClear();
  long.mockClear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(createElement(Btn)));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('useLongPress', () => {
  it('a quick tap is a tap', () => {
    const b = host.querySelector('button')!;
    fire(b, 'pointerdown'); fire(b, 'pointerup'); fire(b, 'click');
    expect(tap).toHaveBeenCalledTimes(1);
    expect(long).not.toHaveBeenCalled();
  });
  it('a hold fires the long action and swallows the click', () => {
    const b = host.querySelector('button')!;
    fire(b, 'pointerdown');
    act(() => void vi.advanceTimersByTime(600));
    fire(b, 'pointerup'); fire(b, 'click');
    expect(long).toHaveBeenCalledTimes(1);
    expect(tap).not.toHaveBeenCalled();
  });
});
