import type { SeasonPhase, SpotScores } from "./types";
import type { SpotReading } from "../types";

/** Season phases that follow the calendar: [first month (0-11), first day, id, notes]. */
export type PhaseRow = [month: number, day: number, id: string, notes: string];

/** Pick the row in effect on `at`. Rows must be in calendar order; the last one wraps into January. */
export function phaseByDate(rows: PhaseRow[], at: Date): SeasonPhase {
  const m = at.getUTCMonth(), d = at.getUTCDate();
  let pick = rows[rows.length - 1]!;
  for (const row of rows) if (m > row[0] || (m === row[0] && d >= row[1])) pick = row;
  return { id: pick[2], notes: pick[3], rutPeakConfident: true };
}

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** +1 on a north-facing slope, -1 on a south-facing one, 0 on the flat. */
export function northness(spot: SpotReading): number {
  return spot.aspectDeg === null ? 0 : Math.cos((spot.aspectDeg * Math.PI) / 180);
}

export function isOpen(spot: SpotReading): boolean {
  return !spot.cover.woody && spot.cover.code !== 52 && spot.cover.code !== 11;
}

export type { SpotScores };
