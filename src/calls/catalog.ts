/** The call pads. Order is the order they appear on the sheet. Every pad plays a real recording or nothing. */

export type CallSpecies = 'deer' | 'squirrel' | 'turkey';

export interface CallDef {
  id: string;
  species: CallSpecies;
  name: string;
  /** What the sound is and when it is used, from the literature where there is some. */
  blurb: string;
}

export const CALLS: CallDef[] = [
  {
    id: 'deer-grunt',
    species: 'deer',
    name: 'Grunt',
    blurb: 'Short low grunt. Dominant deer use it to move another deer along (Atkeson et al. 1988). Hold for a string of them.',
  },
  {
    id: 'deer-bleat',
    species: 'deer',
    name: 'Bleat',
    blurb: 'Higher, tonal bleat. Fawns use it to call a doe, and she comes to look (Atkeson et al. 1988).',
  },
  {
    id: 'deer-snort-wheeze',
    species: 'deer',
    name: 'Snort-wheeze',
    blurb: 'A grunt, three snorts, then a long wheeze. The most aggressive buck call, a challenge during the rut (Atkeson et al. 1988).',
  },
  {
    id: 'deer-rattle',
    species: 'deer',
    name: 'Rattle',
    blurb: 'Antlers clacking and grinding, two bucks sparring. Pre-rut and rut.',
  },
  {
    id: 'squirrel-bark',
    species: 'squirrel',
    name: 'Gray squirrel bark',
    blurb: 'Sharp repeated alarm bark of an eastern gray squirrel.',
  },
  {
    id: 'squirrel-red-chatter',
    species: 'squirrel',
    name: 'Red squirrel chatter',
    blurb: 'A red squirrel scolding in the spruce and pine. Fast, rattling chatter.',
  },
  {
    id: 'squirrel-pine',
    species: 'squirrel',
    name: 'Pine squirrel',
    blurb: 'Another American red (pine) squirrel, recorded in the Rockies.',
  },
  {
    id: 'turkey-yelp',
    species: 'turkey',
    name: 'Hen yelp',
    blurb: 'The basic hen call. Brings a gobbler looking for company in spring.',
  },
  {
    id: 'turkey-hen-call',
    species: 'turkey',
    name: 'Hen calling',
    blurb: 'A clean run of hen calling, the kind used to call up a tom.',
  },
  {
    id: 'turkey-cluck-purr',
    species: 'turkey',
    name: 'Cluck and purr',
    blurb: 'Soft contact calls: a hen content and feeding close by. Good to finish a bird that hangs up.',
  },
  {
    id: 'turkey-putt',
    species: 'turkey',
    name: 'Putt',
    blurb: 'The sharp alarm note. A putt tells turkeys something is wrong. Not a call to use on a bird you are working.',
  },
  {
    id: 'turkey-gobble',
    species: 'turkey',
    name: 'Gobble',
    blurb: 'A tom gobbling. Use it to locate a bird at dawn, and expect a gobbler to answer.',
  },
];

export const callById = (id: string) => CALLS.find((c) => c.id === id);

/** One recorded clip. Credit for it is shown on the Calls sheet. */
export interface CallRecording {
  file: string;
  author: string;
  license: string;
  source: string;
  /** Loop points in seconds, if the clip should loop only part of itself. */
  loopStart?: number;
  loopEnd?: number;
  /** Seconds of silence between repeats while the pad is held. 0 or absent loops seamlessly. */
  gap?: number;
}

export interface CallManifest {
  recordings: Record<string, CallRecording>;
}
