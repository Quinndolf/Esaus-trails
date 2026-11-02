// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { GINSENG_GEAR } from '../gear';
import { GearSheet } from '../GearSheet';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('ginseng gear list', () => {
  it('has a reason for every item and states no legal numbers', () => {
    expect(GINSENG_GEAR.length).toBeGreaterThan(5);
    for (const g of GINSENG_GEAR) {
      expect(g.why.length).toBeGreaterThan(10);
      expect(`${g.name} ${g.why}`).not.toMatch(/\b(\d+\s*(prong|year|inch)|\$)/i);
    }
  });

  it('shows the list in a sheet', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    await act(async () => createRoot(host).render(createElement(GearSheet, { open: true, onClose: () => {} })));
    expect(host.querySelectorAll('[data-testid="ginseng-gear"] li')).toHaveLength(GINSENG_GEAR.length);
    expect(host.textContent).toContain('Digging tool');
  });
});
