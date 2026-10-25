// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { CallsSheet } from '../CallsSheet';
import { callPlayer } from '../player';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Calls sheet', () => {
  afterEach(() => vi.restoreAllMocks());

  it('presses on pointer down and releases on pointer up and cancel', async () => {
    const press = vi.spyOn(callPlayer, 'press').mockResolvedValue();
    const release = vi.spyOn(callPlayer, 'release').mockImplementation(() => {});
    vi.spyOn(callPlayer, 'sources').mockResolvedValue({});
    vi.spyOn(callPlayer, 'credits').mockResolvedValue([]);
    vi.spyOn(callPlayer, 'warm').mockResolvedValue();
    vi.spyOn(callPlayer, 'releaseAll').mockImplementation(() => {});
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(createElement(CallsSheet, { open: true, onClose() {} })));

    const pad = host.querySelector('[data-testid="call-deer-grunt"]') as HTMLElement;
    const ev = (type: string) => Object.assign(new Event(type, { bubbles: true }), { pointerId: 1 });
    await act(async () => void pad.dispatchEvent(ev('pointerdown')));
    expect(press).toHaveBeenCalledWith('deer-grunt');
    await act(async () => void pad.dispatchEvent(ev('pointerup')));
    expect(release).toHaveBeenCalledWith('deer-grunt');

    release.mockClear();
    const bark = host.querySelector('[data-testid="call-squirrel-bark"]') as HTMLElement;
    await act(async () => void bark.dispatchEvent(ev('pointerdown')));
    await act(async () => void bark.dispatchEvent(ev('pointercancel')));
    expect(release).toHaveBeenCalledWith('squirrel-bark');
    expect(host.querySelectorAll('.call-pad').length).toBe(7);
    await act(async () => root.unmount());
  });
});
