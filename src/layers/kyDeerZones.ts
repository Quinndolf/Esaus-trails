// Kentucky deer hunting zones by county, read from the zone map in the KDFWR Kentucky Hunting &
// Trapping Guide, August 2026 to March 2027 (page 10, "Deer Hunting Zones and Seasons"). The guide
// has no county table; this was checked county by county against that map. Update it each season.
export const KY_DEER_SEASON = '2026-27';
export const KY_DEER_GUIDE_URL = 'https://fw.ky.gov/Hunt/Documents/huntingguideentire.pdf';

export type DeerZone = 1 | 2 | 3 | 4;

/** Zone fills from the guide's own legend; Zone 4 is white there, drawn a little grey so it shows. */
export const DEER_ZONE_COLORS: Record<DeerZone, string> = {
  1: '#d6886a',
  2: '#e8beaa',
  3: '#fffac2',
  4: '#f2f2f2',
};

const ZONES: Record<DeerZone, string[]> = {
  1: [
    'Adair', 'Anderson', 'Ballard', 'Boone', 'Boyd', 'Bracken', 'Breckinridge', 'Bullitt', 'Butler', 'Caldwell',
    'Calloway', 'Campbell', 'Carlisle', 'Carroll', 'Carter', 'Christian', 'Crittenden', 'Daviess', 'Franklin', 'Fulton',
    'Gallatin', 'Grant', 'Graves', 'Grayson', 'Green', 'Greenup', 'Hancock', 'Hardin', 'Harrison', 'Hart',
    'Henderson', 'Henry', 'Hickman', 'Hopkins', 'Jefferson', 'Kenton', 'LaRue', 'Lawrence', 'Lewis', 'Livingston',
    'Logan', 'Lyon', 'Marion', 'Marshall', 'Mason', 'McCracken', 'McLean', 'Meade', 'Mercer', 'Metcalfe',
    'Muhlenberg', 'Nelson', 'Ohio', 'Oldham', 'Owen', 'Pendleton', 'Robertson', 'Scott', 'Shelby', 'Spencer',
    'Taylor', 'Todd', 'Trigg', 'Trimble', 'Union', 'Washington', 'Webster', 'Woodford',
  ],
  2: [
    'Allen', 'Barren', 'Bath', 'Bourbon', 'Boyle', 'Casey', 'Clark', 'Cumberland', 'Edmonson', 'Elliott',
    'Fayette', 'Fleming', 'Garrard', 'Jessamine', 'Johnson', 'Lincoln', 'Madison', 'Monroe', 'Montgomery', 'Morgan',
    'Nicholas', 'Rowan', 'Simpson', 'Warren',
  ],
  3: ['Clinton', 'Estill', 'Jackson', 'Laurel', 'Martin', 'Menifee', 'Pike', 'Powell', 'Pulaski', 'Rockcastle', 'Russell', 'Wayne', 'Wolfe'],
  4: ['Bell', 'Breathitt', 'Clay', 'Floyd', 'Harlan', 'Knott', 'Knox', 'Lee', 'Leslie', 'Letcher', 'Magoffin', 'McCreary', 'Owsley', 'Perry', 'Whitley'],
};

/** Counties the guide hatches as changing zone this season. */
export const KY_DEER_ZONE_CHANGED = new Set([
  'Adair', 'Boyd', 'Breckinridge', 'Butler', 'Carter', 'Clinton', 'Cumberland', 'Daviess', 'Elliott', 'Garrard',
  'Grayson', 'Greenup', 'Hancock', 'Jackson', 'Johnson', 'Lawrence', 'Lewis', 'Logan', 'Marion', 'Martin',
  'Meade', 'Menifee', 'Metcalfe', 'Morgan', 'Ohio', 'Pike', 'Rockcastle', 'Rowan', 'Russell', 'Taylor',
]);

export const KY_DEER_ZONE_BY_COUNTY: Record<string, DeerZone> = Object.fromEntries(
  (Object.entries(ZONES) as unknown as [string, string[]][]).flatMap(([zone, counties]) => counties.map((c) => [c, Number(zone) as DeerZone])),
);

/** Census county outlines (2017 cartographic boundaries, simplified) tagged with this season's zone. */
export async function kyDeerZonesGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  const counties = (await import('./data/ky-counties.json')).default as GeoJSON.FeatureCollection;
  return {
    type: 'FeatureCollection',
    features: counties.features.map((f) => {
      const name = String(f.properties?.name);
      return { ...f, properties: { ...f.properties, zone: KY_DEER_ZONE_BY_COUNTY[name] ?? 0, changed: KY_DEER_ZONE_CHANGED.has(name) } };
    }),
  };
}
