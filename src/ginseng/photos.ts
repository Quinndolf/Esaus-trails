/** Real photos for the "How to harvest" slides, listed in public/ginseng/photos/manifest.json. */

export interface SlidePhoto {
  file: string;
  caption: string;
  author: string;
  license: string;
  source: string;
}

export type SlidePhotos = Record<string, SlidePhoto>;

let cached: Promise<SlidePhotos> | null = null;

/** Missing or broken manifest means no photos: the slides fall back to their drawings. */
export function loadSlidePhotos(fetchJson: (url: string) => Promise<unknown> = defaultFetch): Promise<SlidePhotos> {
  cached ??= fetchJson('/ginseng/photos/manifest.json')
    .then((m) => {
      const photos = (m as { photos?: SlidePhotos })?.photos ?? {};
      return Object.fromEntries(Object.entries(photos).filter(([, p]) => p?.file && p.author && p.license && p.source));
    })
    .catch(() => ({}));
  return cached;
}

export function resetSlidePhotos() {
  cached = null;
}

async function defaultFetch(url: string): Promise<unknown> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}
