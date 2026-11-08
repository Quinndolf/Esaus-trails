// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { RouteToggle, routeFeatures, useRouteToggle } from '../RouteToggle';
import { useEsau } from '../../esau/ui/store';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Suggested route button', () => {
  it('stays off until tapped, and is only there when Esau has a route', async () => {
    useRouteToggle.setState({ show: false });
    useEsau.setState({ analysis: null });
    const host = document.createElement('div');
    const root = createRoot(host);
    await act(async () => root.render(createElement(RouteToggle)));
    expect(host.querySelector('[data-testid=route-toggle]')).toBeNull();
    const route = { path: [[-85.5, 37.5], [-85.49, 37.5]] as [number, number][], yards: 960, exposedYd: 0, from: [-85.5, 37.5] as [number, number], to: [-85.49, 37.5] as [number, number] };
    await act(async () => useEsau.setState({ analysis: { spots: [], unsure: false, advisories: [], legal: {} as never, route } }));
    const btn = host.querySelector('[data-testid=route-toggle]') as HTMLButtonElement;
    expect(btn.textContent).toContain('off');
    await act(async () => btn.click());
    expect(useRouteToggle.getState().show).toBe(true);
    expect(btn.textContent).toContain('on · 960 yd');
    act(() => root.unmount());
  });
  it('draws the line and marks the stand at its end', () => {
    const f = routeFeatures([[0, 0], [1, 1]]);
    expect(f.features[0]!.geometry.type).toBe('LineString');
    expect(f.features[1]!.geometry.coordinates).toEqual([1, 1]);
  });
});
