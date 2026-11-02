/** Wind seen while the tracker ran, kept on this phone so a finished hunt can be replayed against the wind it had. */
export interface WindSample {
  at: number;
  fromDeg: number;
  mph: number;
}

const KEY = "esau-wind-log";
const CAP = 300;
const MAX_GAP_MS = 2 * 3600e3;

const valid = (x: unknown): x is WindSample =>
  !!x && typeof x === "object" && [(x as WindSample).at, (x as WindSample).fromDeg, (x as WindSample).mph].every((n) => typeof n === "number" && Number.isFinite(n));

function read(): WindSample[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter(valid) : [];
  } catch {
    return [];
  }
}

export function logWind(sample: WindSample): void {
  if (!valid(sample)) return;
  const next = [...read(), sample].sort((a, b) => a.at - b.at).slice(-CAP);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked */
  }
}

export function samplesBetween(from: number, to: number): WindSample[] {
  return read().filter((s) => s.at >= from && s.at <= to);
}

/** Nearest sample to `t`, or null when there is none within two hours. */
export function windAt(samples: WindSample[], t: number): WindSample | null {
  let best: WindSample | null = null;
  for (const s of samples) if (!best || Math.abs(s.at - t) < Math.abs(best.at - t)) best = s;
  return best && Math.abs(best.at - t) <= MAX_GAP_MS ? best : null;
}
