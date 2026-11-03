export interface Place {
  label: string;
  lat: number;
  lng: number;
  /** [west, south, east, north] when the place is an area (a town, a park). */
  bbox?: [number, number, number, number];
}

const NUM = '(\\d{1,3}(?:\\.\\d+)?)';
const HEMI = '([NSEWnsew])?';
const PAIR = new RegExp(`^${HEMI}\\s*(-?${NUM})\\s*°?\\s*${HEMI}\\s*[,;\\s]\\s*${HEMI}\\s*(-?${NUM})\\s*°?\\s*${HEMI}$`);

/** Reads "37.6, -85.3", "37.6 N 85.3 W", "N37.6 W85.3". Latitude first. Returns null for anything else. */
export function parseLatLng(text: string): { lat: number; lng: number } | null {
  const m = PAIR.exec(text.trim());
  if (!m) return null;
  const [, h1a, a, , h1b, h2a, b, , h2b] = m;
  let lat = parseFloat(a);
  let lng = parseFloat(b);
  const h1 = (h1a ?? h1b)?.toUpperCase();
  const h2 = (h2a ?? h2b)?.toUpperCase();
  if (h1 === 'S') lat = -Math.abs(lat);
  if (h2 === 'W') lng = -Math.abs(lng);
  if (h1 === 'E' || h1 === 'W' || h2 === 'N' || h2 === 'S') return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

/**
 * Finds a place. Coordinates are answered on the spot; anything else goes to OpenStreetMap's free Nominatim.
 * Its policy: no more than one request a second, no search-as-you-type, so this runs only when the hunter submits.
 */
export async function geocode(query: string, doFetch: typeof fetch = fetch): Promise<Place[]> {
  const q = query.trim();
  if (!q) return [];
  const ll = parseLatLng(q);
  if (ll) return [{ label: `${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)}`, ...ll }];
  const url = `${ENDPOINT}?${new URLSearchParams({ q, format: 'jsonv2', limit: '5', addressdetails: '0' })}`;
  const res = await doFetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Place search is not answering. Try again in a moment.');
  const rows = (await res.json()) as Array<{ display_name: string; lat: string; lon: string; boundingbox?: string[] }>;
  return rows.map((r) => {
    const bb = r.boundingbox?.map(Number);
    return {
      label: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      ...(bb && bb.length === 4 && bb.every(Number.isFinite) ? { bbox: [bb[2], bb[0], bb[3], bb[1]] as Place['bbox'] } : {}),
    };
  });
}
