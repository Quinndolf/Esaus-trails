// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { SearchBar } from '../SearchBar';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('maplibre-gl', () => ({
  default: { Marker: class { setLngLat() { return this; } addTo() { return this; } remove() {} } },
}));

async function mount(el: any) {
  const host = document.createElement('div');
  document.body.append(host);
  await act(async () => createRoot(host).render(el));
  return host;
}
afterEach(() => void (document.body.innerHTML = ''));

function fakeMap() {
  return { flyTo: vi.fn(), fitBounds: vi.fn(), getZoom: () => 12 } as any;
}
async function type(host: HTMLElement, v: string) {
  const input = host.querySelector('input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => void host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}

describe('search bar', () => {
  it('opens, flies to a single answer, and stops following the dot', async () => {
    const map = fakeMap();
    const onFly = vi.fn();
    const lookup = vi.fn(async () => [{ label: 'Spot', lat: 37.6, lng: -85.3 }]);
    const host = await mount(createElement(SearchBar, { map, onFly, lookup }));
    await act(async () => void (host.querySelector('[data-testid="search-open"]') as HTMLElement).click());
    await type(host, '37.6, -85.3');
    expect(map.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [-85.3, 37.6], zoom: 16 }));
    expect(onFly).toHaveBeenCalled();
    expect(host.querySelector('[data-testid="search-bar"]')).toBeNull();
  });

  it('lists several answers and flies when one is picked', async () => {
    const map = fakeMap();
    const lookup = vi.fn(async () => [
      { label: 'A, Kentucky', lat: 1, lng: 2 },
      { label: 'B, Kentucky', lat: 3, lng: 4, bbox: [3, 3, 5, 5] as [number, number, number, number] },
    ]);
    const host = await mount(createElement(SearchBar, { map, lookup }));
    await act(async () => void (host.querySelector('[data-testid="search-open"]') as HTMLElement).click());
    await type(host, 'bardstown');
    const items = host.querySelectorAll('[data-testid="search-result"]');
    expect(items).toHaveLength(2);
    await act(async () => void (items[1] as HTMLElement).click());
    expect(map.fitBounds).toHaveBeenCalled();
  });

  it('says so plainly when nothing is found or the service fails', async () => {
    const map = fakeMap();
    let lookup = vi.fn(async () => []);
    let host = await mount(createElement(SearchBar, { map, lookup }));
    await act(async () => void (host.querySelector('[data-testid="search-open"]') as HTMLElement).click());
    await type(host, 'zzzz');
    expect(host.textContent).toContain('Nothing found');
    document.body.innerHTML = '';
    lookup = vi.fn(async () => { throw new Error('Place search is not answering. Try again in a moment.'); });
    host = await mount(createElement(SearchBar, { map, lookup }));
    await act(async () => void (host.querySelector('[data-testid="search-open"]') as HTMLElement).click());
    await type(host, 'zzzz');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('not answering');
    expect(map.flyTo).not.toHaveBeenCalled();
  });
});
