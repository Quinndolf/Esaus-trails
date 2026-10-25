/** The call pads. Order is the order they appear on the sheet. */

export type CallSpecies = 'deer' | 'squirrel';

export interface CallDef {
  id: string;
  species: CallSpecies;
  name: string;
  /** What the sound is and when it is used, from the literature where there is some. */
  blurb: string;
  /** Filename under /calls/ the player prefers when it is listed in the manifest. */
  file: string;
}

export const CALLS: CallDef[] = [
  {
    id: 'deer-grunt',
    species: 'deer',
    name: 'Grunt',
    blurb:
      'Short low grunt, a tenth to four-tenths of a second. Dominant deer use it to move another deer along (Atkeson et al. 1988). Hold for a string of them, the way a buck trails a doe.',
    file: 'deer-grunt.mp3',
  },
  {
    id: 'deer-bleat',
    species: 'deer',
    name: 'Bleat',
    blurb: 'Higher, tonal bleat. Fawns use it to call a doe; she comes to look (Atkeson et al. 1988). Hold to keep bleating.',
    file: 'deer-bleat.mp3',
  },
  {
    id: 'deer-snort-wheeze',
    species: 'deer',
    name: 'Snort-wheeze',
    blurb:
      'A grunt, three sharp snorts, then a long breathy wheeze. The most aggressive buck call, a challenge during the rut (Atkeson et al. 1988). It can pull a buck in or send a smaller one running.',
    file: 'deer-snort-wheeze.mp3',
  },
  {
    id: 'deer-rattle',
    species: 'deer',
    name: 'Rattle',
    blurb: 'Antlers clacking and grinding, two bucks sparring. Pre-rut and rut. Hold for as long as the fight lasts.',
    file: 'deer-rattle.mp3',
  },
  {
    id: 'squirrel-bark',
    species: 'squirrel',
    name: 'Bark',
    blurb: 'Sharp repeated "kuk" alarm bark. Squirrels give it at a hawk or a hunter, and it makes others look for the trouble.',
    file: 'squirrel-bark.mp3',
  },
  {
    id: 'squirrel-distress',
    species: 'squirrel',
    name: 'Distress',
    blurb: 'A harsh high squeal, a squirrel in trouble. Brings neighbours to look, and the predators that listen for it.',
    file: 'squirrel-distress.mp3',
  },
  {
    id: 'squirrel-cutter',
    species: 'squirrel',
    name: 'Cutter',
    blurb: 'Fast scolding chatter, one run of clicks after another. Use it to find squirrels or to keep one talking.',
    file: 'squirrel-cutter.mp3',
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
}

export interface CallManifest {
  recordings: Record<string, CallRecording>;
}
