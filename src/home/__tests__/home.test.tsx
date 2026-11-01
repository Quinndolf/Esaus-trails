// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimalChip } from '../AnimalChip';
import { Tutorial } from '../Tutorial';
import { ExitPrompt } from '../ExitPrompt';
import { nextLocation } from '../location';
import { loadSnags } from '../snag';
import { useWeapon } from '../weapon';
import { useEsau } from '../../esau/ui/store';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(el: any) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(el));
  return host;
}
const click = (host: HTMLElement, sel: string) => act(async () => void (host.querySelector(sel) as HTMLElement).click());

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  useEsau.setState({ species: null, choosing: false });
  useWeapon.setState({ weapon: null });
});

describe('animal chip', () => {
  it('opens a list in order, then asks the weapon, then shows "Whitetail · Crossbow"', async () => {
    const host = await mount(createElement(AnimalChip));
    expect(host.querySelector('[data-testid="animal-chip"]')?.textContent).toContain('What are you hunting?');
    await click(host, '[data-testid="animal-chip"]');
    const names = [...host.querySelectorAll('[data-testid^="animal-"][role="option"]')].map((e) => e.getAttribute('data-testid'));
    expect(names.slice(0, 4)).toEqual(['animal-whitetail', 'animal-squirrel', 'animal-ginseng', 'animal-turkey']);
    await click(host, '[data-testid="animal-whitetail"]');
    expect(host.textContent).toContain('What are you hunting with?');
    await click(host, '[data-testid="weapon-crossbow"]');
    expect(useEsau.getState().species).toBe('whitetail');
    expect(useWeapon.getState().weapon).toBe('crossbow');
    expect(host.querySelector('[data-testid="animal-chip"]')?.textContent).toContain('Whitetail · Crossbow');
    expect(host.querySelector('[role="listbox"]')).toBeNull();
  });

  it('skips the weapon question for ginseng', async () => {
    const host = await mount(createElement(AnimalChip));
    await click(host, '[data-testid="animal-chip"]');
    await click(host, '[data-testid="animal-ginseng"]');
    expect(useEsau.getState().species).toBe('ginseng');
    expect(useWeapon.getState().weapon).toBeNull();
    expect(host.querySelector('[role="listbox"]')).toBeNull();
  });
});

describe('location button', () => {
  it('centers, then compass, then back to following', () => {
    expect(nextLocation('free')).toBe('follow');
    expect(nextLocation('follow')).toBe('compass');
    expect(nextLocation('compass')).toBe('follow');
  });
});

describe('tutorial', () => {
  it('shows once; Skip remembers it', async () => {
    const host = await mount(createElement(Tutorial));
    expect(host.querySelector('[data-testid="tutorial"]')).toBeTruthy();
    await click(host, '[data-testid="tutorial-skip"]');
    expect(host.querySelector('[data-testid="tutorial"]')).toBeNull();
    document.body.innerHTML = '';
    const again = await mount(createElement(Tutorial));
    expect(again.querySelector('[data-testid="tutorial"]')).toBeNull();
  });

  it('still shows when localStorage throws', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const host = await mount(createElement(Tutorial));
    expect(host.querySelector('[data-testid="tutorial"]')).toBeTruthy();
    spy.mockRestore();
  });
});

describe('exit prompt', () => {
  it('saves a snag answer on the phone only', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const host = await mount(createElement(ExitPrompt, { open: true, onClose: () => {} }));
    expect(host.textContent).toContain('Did you snag anything?');
    await click(host, '[data-testid="snag-yes"]');
    await act(async () => {
      const input = host.querySelector('[data-testid="snag-what"]') as HTMLInputElement;
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(input, 'Doe');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(host, '[data-testid="snag-save"]');
    expect(loadSnags()).toMatchObject([{ yes: true, what: 'Doe' }]);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
