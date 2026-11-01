// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EsauPanel } from '../EsauPanel';
import { useEsau } from '../store';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Teach me more', () => {
  afterEach(() => useEsau.setState({ open: false, reply: null, spot: null }));

  it('shows only the short read until the hunter taps Teach me more', async () => {
    useEsau.setState({
      open: true,
      species: 'whitetail',
      spot: { lat: 37.0, lng: -85.7 },
      status: 'ready',
      reply: {
        say: 'He is bedded on the bench. Wind is wrong from the west.',
        more: 'THE FULL LESSON ABOUT BENCHES.',
        headline: 'Bench bed',
        confidence: 'fair',
        spotRole: 'bedding',
        marks: [],
        wouldChangeMyMind: [],
        meta: { model: 'm', servedBy: 'm', inputTokens: 0, outputTokens: 0, ms: 0 },
      },
    });
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(createElement(EsauPanel)));
    expect(host.textContent).toContain('bedded on the bench');
    expect(host.textContent).not.toContain('FULL LESSON');
    await act(async () => void (host.querySelector('[data-testid="teach-more"]') as HTMLElement).click());
    expect(host.textContent).toContain('FULL LESSON');
    expect(host.querySelector('[data-testid="teach-more"]')).toBeNull();
  });
});
