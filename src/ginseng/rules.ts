/**
 * Kentucky wild ginseng (Panax quinquefolius) harvest rules, as read on 2026-10-25 from
 * 302 KAR 45:010 and the Kentucky Department of Agriculture ginseng pages. This is a summary
 * for a hunter in the woods, not legal advice: the regulation and the state's pages govern,
 * and rules change. Check them before you dig.
 */

export const GINSENG_SOURCES = {
  kar: '302 KAR 45:010, Kentucky Administrative Regulations. https://apps.legislature.ky.gov/law/kar/titles/302/045/010/',
  kda: 'Kentucky Department of Agriculture, Ginseng Program FAQ. https://www.kyagr.com/Content.aspx?PageId=410',
  dbnf: 'WMKY, "Ginseng harvesting prohibited in Daniel Boone National Forest," 12 Oct 2023. https://www.wmky.org/2023-10-12/ginseng-harvesting-prohibited-in-daniel-boone-national-forest',
} as const;

export interface GinsengRule {
  id: string;
  title: string;
  body: string;
  source: keyof typeof GINSENG_SOURCES;
}

export const KY_GINSENG_RULES: GinsengRule[] = [
  {
    id: 'season',
    title: 'Season: September 1 to December 1',
    body: 'Wild ginseng may only be harvested from September 1 through December 1 each year. Not before, not after, and the date applies on private land too.',
    source: 'kar',
  },
  {
    id: 'plant',
    title: 'Five years old, three prongs',
    body: 'Do not dig a plant younger than five years or one with fewer than three five-leaflet prongs. Leave every smaller plant in the ground.',
    source: 'kar',
  },
  {
    id: 'seed',
    title: 'Plant the seed',
    body: 'Seeds on a plant you take must be planted within 50 feet of where it grew, by hand, using nothing but a finger.',
    source: 'kar',
  },
  {
    id: 'permission',
    title: 'Get the landowner\'s permission',
    body: 'Kentucky does not issue a digging permit, but the Department of Agriculture says always get permission from the property owner first. Digging on land you do not have permission to be on is trespass, and taking plants from it is theft.',
    source: 'kda',
  },
  {
    id: 'public',
    title: 'Not on public land',
    body: 'Harvest on state property, including state parks, and on federal management areas is not allowed. Daniel Boone National Forest has not issued ginseng permits in recent years because the plant is declining there.',
    source: 'kda',
  },
  {
    id: 'sale',
    title: 'Selling',
    body: 'Fresh green roots can be sold from September 1; dried roots from September 15 through March 31, to licensed Kentucky dealers. Ginseng sold outside Kentucky has to be certified by the Department of Agriculture first.',
    source: 'kda',
  },
];

export interface SeasonStatus {
  open: boolean;
  /** Whole days until the season opens (when closed) or until it closes (when open). */
  days: number;
  text: string;
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DAY = 864e5;

/** Kentucky's season is September 1 through December 1, in local time. */
export function seasonStatus(now: Date): SeasonStatus {
  const y = now.getFullYear();
  const opens = new Date(y, 8, 1).getTime();
  const closes = new Date(y, 11, 1).getTime();
  const t = dayStart(now);
  if (t >= opens && t <= closes) {
    const days = Math.round((closes - t) / DAY);
    return {
      open: true,
      days,
      text: days === 0 ? 'Season closes today (Dec 1)' : `Season open: ${days} day${days === 1 ? '' : 's'} left (closes Dec 1)`,
    };
  }
  const next = t < opens ? opens : new Date(y + 1, 8, 1).getTime();
  const days = Math.round((next - t) / DAY);
  return { open: false, days, text: `Season closed: opens Sep 1 (${days} days). Scout, don't dig.` };
}
