// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { SpeciesPicker, HuntPill } from '../SpeciesPicker';
import { useEsau } from '../store';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('species picker', () => {
  afterEach(() => useEsau.setState({ species: null, choosing: false }));

  it('blocks the app until an animal is chosen, then scopes Esau to it', async () => {
    useEsau.setState({ species: null, choosing: false });
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(createElement('div', null, createElement(SpeciesPicker), createElement(HuntPill))));

    expect(host.querySelector('[data-testid="species-picker"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="hunt-pill"]')).toBeNull();
    expect(host.querySelector('[data-testid="pick-squirrel"]')).toBeTruthy();

    // A tap before choosing reads nothing.
    await act(async () => void useEsau.getState().tapSpot({ lat: 37.5, lng: -85.5 }));
    expect(useEsau.getState().open).toBe(false);

    await act(async () => void (host.querySelector('[data-testid="pick-squirrel"]') as HTMLElement).click());
    expect(useEsau.getState().species).toBe('squirrel');
    expect(host.querySelector('[data-testid="species-picker"]')).toBeNull();
    expect(host.querySelector('[data-testid="hunt-pill"]')?.textContent).toContain('Squirrel');

    await act(async () => void (host.querySelector('[data-testid="hunt-pill"]') as HTMLElement).click());
    expect(host.querySelector('[data-testid="species-picker"]')).toBeTruthy();
    await act(async () => root.unmount());
  });
});
