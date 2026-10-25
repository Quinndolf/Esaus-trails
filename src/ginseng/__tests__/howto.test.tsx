// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { HowToSheet } from '../HowToSheet';
import { SLIDES } from '../slides';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('How to harvest slides', () => {
  it('has seven steps, each with art and a caption, and the legal ones say what the law says', () => {
    expect(SLIDES.length).toBe(7);
    for (const s of SLIDES) {
      expect(s.caption.length).toBeGreaterThan(0);
      expect(s.art).toBeTruthy();
    }
    const text = SLIDES.flatMap((s) => s.caption).join(' ').toLowerCase();
    for (const need of ['september 1 through december 1', 'permission', 'three prongs', 'five years', '50 feet', 'finger', 'licensed']) expect(text).toContain(need);
    expect(SLIDES.filter((s) => s.kind === 'field practice').map((s) => s.id)).toEqual(['dig', 'leave']);
  });

  it('steps through with Next and Back and marks the end', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(createElement(HowToSheet, { open: true, onClose() {} })));
    const click = async (label: string) => {
      const b = [...host.querySelectorAll('button')].find((x) => x.textContent === label)!;
      await act(async () => void b.click());
    };
    expect(host.textContent).toContain('Step 1 of 7');
    await click('Next');
    expect(host.textContent).toContain('Step 2 of 7');
    expect(host.querySelector('[data-testid="howto-art"] svg')).toBeTruthy();
    await click('Back');
    expect(host.textContent).toContain('Step 1 of 7');
    for (let k = 0; k < 6; k++) await click('Next');
    expect(host.textContent).toContain('Step 7 of 7');
    expect([...host.querySelectorAll('button')].find((x) => x.textContent === 'Next')!.hasAttribute('disabled')).toBe(true);
    await act(async () => root.unmount());
  });
});

describe('slide photos', () => {
  it('uses a listed photo first with its credit, and the drawing one tap away', async () => {
    const { loadSlidePhotos, resetSlidePhotos } = await import('../photos');
    resetSlidePhotos();
    const photos = await loadSlidePhotos(async () => ({
      photos: {
        know: { file: 'know.jpg', caption: 'A plant', author: 'W. Cass, NPS', license: 'Public domain', source: 'https://example.org/a' },
        bad: { file: 'x.jpg' },
      },
    }));
    expect(Object.keys(photos)).toEqual(['know']);
    resetSlidePhotos();
    await loadSlidePhotos(async () => ({
      photos: { know: { file: 'know.jpg', caption: 'A plant', author: 'W. Cass, NPS', license: 'Public domain', source: 'https://example.org/a' } },
    }));
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(createElement(HowToSheet, { open: true, onClose() {} })));
    const click = async (label: string) => {
      const b = [...host.querySelectorAll('button')].find((x) => x.textContent === label)!;
      await act(async () => void b.click());
    };
    expect(host.querySelector('[data-testid="howto-photo"]')).toBeNull(); // step 1 has no photo
    await click('Next');
    expect(host.querySelector('[data-testid="howto-photo"] img')?.getAttribute('src')).toBe('/ginseng/photos/know.jpg');
    expect(host.textContent).toContain('W. Cass, NPS, Public domain');
    await click('Drawing');
    expect(host.querySelector('[data-testid="howto-art"] svg')).toBeTruthy();
    await act(async () => root.unmount());
    resetSlidePhotos();
  });

  it('falls back to drawings when the manifest is missing', async () => {
    const { loadSlidePhotos, resetSlidePhotos } = await import('../photos');
    resetSlidePhotos();
    expect(await loadSlidePhotos(async () => Promise.reject(new Error('404')))).toEqual({});
    resetSlidePhotos();
  });
});
