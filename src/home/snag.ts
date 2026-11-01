/** "Did you snag anything?" answers. Kept on the phone only; nothing here is ever sent anywhere. */
export interface Snag {
  at: number;
  yes: boolean;
  what?: string;
  where?: string;
}

const KEY = 'esau-snags';

export function loadSnags(): Snag[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Snag[];
  } catch {
    return [];
  }
}

export function saveSnag(s: Snag): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...loadSnags(), s]));
  } catch {
    /* ignore */
  }
}
