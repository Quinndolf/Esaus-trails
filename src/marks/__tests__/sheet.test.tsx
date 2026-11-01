// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MarksSheet, UndoToast } from '../MarksSheet';
import { useTools } from '../../tools/store';
import { usePhotoPins } from '../../photos/store';
import { useUndoDeletes, UNDO_MS } from '../undo';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const wp = (id: string, name: string) =>
  ({ id, name, icon: 'x', notes: '', position: [-85.5, 37.5], altitude: null, photoIds: [], createdAt: '2026-10-31T12:00:00Z', updatedAt: '2026-10-31T12:00:00Z' }) as any;

async function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  await act(async () => createRoot(host).render(createElement('div', null, createElement(MarksSheet, { open: true, onClose: () => {}, map: null }), createElement(UndoToast))));
  return host;
}
const click = (host: HTMLElement, sel: string) => act(async () => void (host.querySelector(sel) as HTMLElement).click());

describe('My Marks sheet', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTools.setState({ waypoints: [wp('w1', 'Tree stand'), wp('w2', 'Marked 6:40 PM')], shapes: [], tracks: [], removeWaypoint: vi.fn(async () => {}) } as any);
    usePhotoPins.setState({ pins: [] });
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    useUndoDeletes.setState({ pending: {} });
  });

  it('lists marks and searches by name', async () => {
    const host = await mount();
    expect(host.querySelectorAll('.mark-row')).toHaveLength(2);
    await act(async () => {
      const i = host.querySelector('input[type="search"]') as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(i, 'tree');
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(host.querySelectorAll('.mark-row')).toHaveLength(1);
  });

  it('delete hides the row, offers Undo, and removes it for real after 5 seconds', async () => {
    const host = await mount();
    await click(host, '[data-testid="mark-del-w1"]');
    expect(host.querySelector('[data-testid="mark-w1"]')).toBeNull();
    expect(host.querySelector('[data-testid="undo-toast"]')?.textContent).toContain('Tree stand');
    expect(useTools.getState().removeWaypoint).not.toHaveBeenCalled();
    await act(async () => void vi.advanceTimersByTime(UNDO_MS));
    expect(useTools.getState().removeWaypoint).toHaveBeenCalledWith('w1');
  });

  it('Undo brings the row back and never deletes', async () => {
    const host = await mount();
    await click(host, '[data-testid="mark-del-w1"]');
    await click(host, '[data-testid="undo-toast"] button');
    expect(host.querySelector('[data-testid="mark-w1"]')).toBeTruthy();
    await act(async () => void vi.advanceTimersByTime(UNDO_MS * 2));
    expect(useTools.getState().removeWaypoint).not.toHaveBeenCalled();
  });
});
