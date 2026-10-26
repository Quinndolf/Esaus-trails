// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useEsau } from '../../esau/ui/store';
import { CallButton, HOLD_MS } from '../CallButton';
import { CallsSheet } from '../CallsSheet';
import { CALLS, callsFor } from '../catalog';
import { callPlayer } from '../player';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const allRecorded = () => Object.fromEntries(CALLS.map((c) => [c.id, 'recording'])) as Record<string, 'recording' | 'missing'>;
const ev = (type: string) => Object.assign(new Event(type, { bubbles: true }), { pointerId: 1 });

let host: HTMLDivElement;
let root: Root;
async function mount(el: ReturnType<typeof createElement>) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(el));
}

describe('call button', () => {
  let press: any;
  let release: any;
  beforeEach(() => {
    vi.useFakeTimers();
    press = vi.spyOn(callPlayer, 'press').mockResolvedValue('playing');
    release = vi.spyOn(callPlayer, 'release').mockImplementation(() => {});
    vi.spyOn(callPlayer, 'unlock').mockImplementation(() => {});
    vi.spyOn(callPlayer, 'sources').mockResolvedValue(allRecorded());
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    useEsau.setState({ species: null });
  });
  const button = () => host.querySelector('[data-testid="call-button"]') as HTMLElement | null;

  it('offers only the hunted animal’s calls; tap steps silently, hold plays', async () => {
    useEsau.setState({ species: 'whitetail' });
    await mount(createElement(CallButton));
    const deer = callsFor('whitetail');
    expect(button()!.textContent).toContain(deer[0].name);

    // Quick tap: next call, no sound.
    await act(async () => void button()!.dispatchEvent(ev('pointerdown')));
    await act(async () => void vi.advanceTimersByTime(HOLD_MS - 50));
    await act(async () => void button()!.dispatchEvent(ev('pointerup')));
    expect(press).not.toHaveBeenCalled();
    expect(button()!.textContent).toContain(deer[1].name);

    // Hold: plays the selected call until the finger lifts.
    await act(async () => void button()!.dispatchEvent(ev('pointerdown')));
    await act(async () => void vi.advanceTimersByTime(HOLD_MS + 10));
    expect(press).toHaveBeenCalledWith(deer[1].id);
    await act(async () => void button()!.dispatchEvent(ev('pointerup')));
    expect(release).toHaveBeenCalledWith(deer[1].id);
    expect(button()!.textContent).toContain(deer[1].name); // a hold does not step
  });

  it('wraps around and follows a change of animal', async () => {
    useEsau.setState({ species: 'turkey' });
    await mount(createElement(CallButton));
    const turkey = callsFor('turkey');
    for (let i = 0; i < turkey.length; i++) {
      await act(async () => void button()!.dispatchEvent(ev('pointerdown')));
      await act(async () => void button()!.dispatchEvent(ev('pointerup')));
    }
    expect(button()!.textContent).toContain(turkey[0].name);
    await act(async () => void useEsau.setState({ species: 'squirrel' }));
    expect(button()!.textContent).toContain(callsFor('squirrel')[0].name);
  });

  it('is hidden for an animal with no calls, and skips calls with no recording', async () => {
    useEsau.setState({ species: 'elk' });
    await mount(createElement(CallButton));
    expect(button()).toBeNull();
    await act(async () => root.unmount());
    vi.spyOn(callPlayer, 'sources').mockResolvedValue({ ...allRecorded(), 'deer-grunt': 'missing' });
    useEsau.setState({ species: 'whitetail' });
    await mount(createElement(CallButton));
    expect(button()!.textContent).not.toContain('Grunt');
  });
});

describe('Calls sheet', () => {
  afterEach(() => vi.restoreAllMocks());
  it('explains the button and lists the calls with credits, no pads', async () => {
    vi.spyOn(callPlayer, 'sources').mockResolvedValue({ ...allRecorded(), 'turkey-putt': 'missing' });
    vi.spyOn(callPlayer, 'credits').mockResolvedValue([{ id: 'turkey-gobble', file: 'x.mp3', author: 'NPS', license: 'Public domain', source: 'https://nps.gov' }]);
    await mount(createElement(CallsSheet, { open: true, onClose() {}, species: 'turkey' }));
    expect(host.textContent).toContain('Tap it to step to the next call');
    expect(host.querySelectorAll('[data-testid^="call-info-"]').length).toBe(callsFor('turkey').length);
    expect(host.querySelector('[data-testid="call-info-turkey-putt"]')!.textContent).toContain('No recording yet');
    expect(host.textContent).toContain('NPS, Public domain');
    expect(host.querySelector('button.call-pad')).toBeNull();
    await act(async () => root.unmount());
    host.remove();
  });
});
