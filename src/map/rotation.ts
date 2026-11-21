/** Smallest angle the map is turned off north, -180..180. 0 means north is up. */
export function turnedOffNorth(bearing: number): number {
  return ((((bearing + 180) % 360) + 360) % 360) - 180;
}

/** Show the "north" button only once the map is really turned (ignores tiny wobble). */
export function showNorthButton(bearing: number): boolean {
  return Math.abs(turnedOffNorth(bearing)) >= 1;
}

/** Bearing the map should hold on each GPS fix: heading-up in compass mode, otherwise wherever the hunter turned it. */
export function followBearing(mode: 'free' | 'follow' | 'compass', heading: number | null, current: number): number {
  return mode === 'compass' ? (heading ?? current) : current;
}
