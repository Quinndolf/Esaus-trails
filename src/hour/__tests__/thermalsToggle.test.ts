// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('thermals toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  it('is on by default and remembers being switched off', async () => {
    const { useHour } = await import('../store');
    expect(useHour.getState().showThermals).toBe(true);
    useHour.getState().setShowThermals(false);
    expect(useHour.getState().showThermals).toBe(false);
    vi.resetModules();
    const again = await import('../store');
    expect(again.useHour.getState().showThermals).toBe(false);
  });
});
