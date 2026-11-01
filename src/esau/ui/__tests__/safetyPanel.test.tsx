// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EsauPanel } from '../EsauPanel';
import { useEsau } from '../store';
import { hollowGrid } from '../../fixtures/hollow';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('safety lines stay on screen', () => {
  afterEach(() => useEsau.setState({ open: false, analysis: null, spot: null }));
  it('keeps a once-per-hunt line visible after the render that first showed it', async () => {
    useEsau.setState({
      open: true,
      species: 'whitetail',
      weapon: 'rifle',
      spot: { lat: 37.69, lng: -84.29 },
      grid: hollowGrid(),
      hourIndex: 0,
      status: 'ready',
      reply: null,
      analysis: { spots: [], unsure: true, advisories: [], legal: { status: 'open', note: '', seasonLabel: 'modern gun season' } },
    });
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(createElement(EsauPanel)));
    await act(async () => {});
    expect(host.textContent).toMatch(/blaze orange/i);
    await act(async () => root.render(createElement(EsauPanel)));
    expect(host.textContent).toMatch(/blaze orange/i);
  });
});
