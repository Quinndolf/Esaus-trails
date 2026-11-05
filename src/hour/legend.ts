import type { HourScope } from './scope';
import { ThermalState } from '../model/types';

/**
 * Plain-words explanations of everything the hour model draws on the map, for a beginner.
 * `legendItems` is the map key; `explainFeature` is what Esau says when a mark is tapped.
 * Colors here must match the paint in useHourOverlays.ts and overlays.ts.
 */

export type Swatch =
  | { kind: 'dash' | 'line' | 'arrow' | 'tick'; color: string; color2?: string }
  | { kind: 'dot'; color: string; ring: string }
  | { kind: 'fill'; colors: string[] }
  | { kind: 'ring'; label?: string };

export interface LegendItem {
  id: string;
  swatch: Swatch;
  name: string;
  says: string;
}

/** Thermal tick colors by state. Rising and sinking match the shading (red up, light blue down). */
export const TICK_COLORS = { rising: '#ff9c8f', sinking: '#bfe6ff', pooling: '#c9a3ff' } as const;
export const WIND_COLORS = { normal: '#ffffff', eddy: '#ff7a59' } as const;
export const TRAIL_COLOR = '#f2c14e';
export const BED_COLORS = { fill: '#8b5a2b', ring: '#f2c14e' } as const;
export const SCENT_COLOR = '#c8f560';

export interface LegendOpts {
  /** The "food" layer toggle (deer only). */
  food: boolean;
  /** The Thermals on/off toggle on the hour bar. */
  thermals: boolean;
}

export function legendItems(scope: HourScope | null, opts: LegendOpts): LegendItem[] {
  if (!scope) return [];
  const animal = scope.noun.toLowerCase();
  const items: LegendItem[] = [];
  if (scope.thermals && opts.thermals) {
    items.push(
      {
        id: 'thermal-shade',
        swatch: { kind: 'fill', colors: ['rgb(150,20,30)', 'rgb(120,200,255)'] },
        name: 'Red and blue shading: air moving along the ground',
        says: 'Dark red is warm air rising uphill, usually mid-morning to afternoon on sunny slopes. Light blue is cool air sinking downhill or pooling in low ground, in the evening, at night and early morning. No shading means the air is settled, and the shading fades out when the wind is over about 15 mph, because then the wind moves the air. Your scent rides this air when the wind is light. Turn it off with Thermals on the hour bar.',
      },
      {
        id: 'thermal-ticks',
        swatch: { kind: 'tick', color: TICK_COLORS.rising, color2: TICK_COLORS.sinking },
        name: 'Short ticks: which way that air slides',
        says: 'Each little hooked tick points the way the air is sliding. Red ticks go uphill, light blue ticks go downhill, and purple ticks mean cold air is pooling in low ground.',
      },
    );
  }
  items.push({
    id: 'wind',
    swatch: { kind: 'arrow', color: WIND_COLORS.normal, color2: WIND_COLORS.eddy },
    name: 'White arrows: the wind',
    says: 'Each arrow points where the wind is blowing to, and your scent goes the same way. Longer arrows mean stronger wind. Orange arrows mark spots where the wind rolls over a steep slope and swirls, so scent can go any way there.',
  });
  if (scope.movement) {
    items.push(
      {
        id: 'trails',
        swatch: { kind: 'dash', color: TRAIL_COLOR },
        name: 'Yellow dashed lines: likely deer trails',
        says: 'Where deer will likely walk this hour, between bedding and food. Thicker and brighter means more deer moving on it now. Sit off to the side, downwind, and never walk on it.',
      },
      {
        id: 'beds',
        swatch: { kind: 'dot', color: BED_COLORS.fill, ring: BED_COLORS.ring },
        name: 'Brown dots with a yellow rim: likely bedding',
        says: 'Where deer likely lie up during the day. A bigger, more solid dot means deer are probably bedded there right now. Stay well back from it and hunt the trails leading out.',
      },
    );
  }
  if (scope.movement || scope.likelihood) {
    items.push({
      id: 'presence',
      swatch: { kind: 'fill', colors: ['rgba(255,200,40,0.5)', 'rgba(255,60,40,0.85)'] },
      name: `Orange to red glow: where ${animal} likely are`,
      says: `Where ${animal} are most likely to be this hour. Redder means more likely. Move the hour bar to watch it shift through the day.`,
    });
  }
  if (scope.movement && opts.food) {
    items.push({
      id: 'food',
      swatch: { kind: 'fill', colors: ['rgb(232,150,30)', 'rgb(110,200,70)', 'rgb(70,170,160)'] },
      name: 'Soft amber, green and teal: food',
      says: 'Where deer feed this season. Amber is acorn ground (oaks), green is crops, and teal is browse, the young brush and shoots deer nibble.',
    });
  }
  if (scope.scent) {
    items.push({
      id: 'scent',
      swatch: { kind: 'fill', colors: [SCENT_COLOR] },
      name: 'Lime-green cone: your scent',
      says: "Where your smell drifts this hour, from where you are (or the middle of the map when your location is off). Any animal inside it will likely smell you, so keep it off trails and beds.",
    });
  }
  items.push({
    id: 'sit-spots',
    swatch: { kind: 'ring', label: '1' },
    name: "Numbered dashed circles: Esau's sit spots",
    says: 'After Analyze area, Esau marks his top 3 places to sit for this hour. Tap a number to see why he picked it.',
  });
  return items;
}

export interface Explained {
  title: string;
  text: string;
}

/** What Esau says about one tapped mark. `layer` is the map layer id; `props` the feature's properties. */
export function explainFeature(layer: string, props: Record<string, unknown>, noun = 'Deer'): Explained | null {
  const animal = noun.toLowerCase();
  switch (layer) {
    case 'hour-beds': {
      const bedded = Number(props.bedded) >= 0.5;
      return {
        title: 'Likely bedding',
        text: `This is where ${animal} likely lie up during the day: thick cover, often on a bench or point just under a ridge, where they can smell what comes from behind. ${
          bedded ? 'The dot is big and solid, so they are probably bedded here right now.' : 'The dot is small and faint, so they are probably up and moving right now.'
        } Don't walk in close, or they'll leave for good. Hunt the trails leading out of it, downwind.`,
      };
    }
    case 'hour-trails':
    case 'hour-trails-casing':
      return {
        title: 'Likely trail',
        text: `${noun} will likely walk here this hour, taking the easy way between where they bed and where they eat. Thicker and brighter means more traffic right now. Sit off to the side with the wind blowing from the trail to you, stay within your weapon's range, and don't walk on it.`,
      };
    case 'hour-facing':
      return {
        title: 'Trail ahead of you',
        text: 'With the compass on, Esau brightens the trails in the direction you are facing, so you know what you are looking at.',
      };
    case 'hour-wind': {
      const mph = Number(props.mph);
      const speed = Number.isFinite(mph) && mph > 0 ? ` at about ${Math.round(mph)} mph here` : '';
      if (props.eddy === true) {
        return {
          title: 'Swirling wind',
          text: `The wind rolls over a steep slope here and curls back${speed}. Your scent can go any way, so this is a poor place to sit.`,
        };
      }
      return {
        title: 'Wind',
        text: `The arrow points where the wind is blowing to${speed}. Your scent goes the same way, so sit where the arrow points away from where ${animal} will be.`,
      };
    }
    case 'hour-ticks': {
      const s = Number(props.state);
      const how =
        s === ThermalState.Rising
          ? 'warm air rising uphill, so your scent lifts up the slope'
          : s === ThermalState.Pooling
            ? 'cold air pooling in low ground, so scent sits and spreads in the bottom'
            : 'cool air sinking downhill, so your scent flows down to lower ground';
      return {
        title: 'Air sliding along the ground',
        text: `This tick shows ${how}. It matters most when the wind is light.`,
      };
    }
    case 'hour-scent-fill':
    case 'hour-scent-line':
      return {
        title: 'Your scent',
        text: `This is where your smell drifts this hour, from where you are (or the middle of the map when your location is off). Any ${animal} inside it will likely smell you.`,
      };
    default:
      return null;
  }
}

/**
 * Layers a tap can explain, most specific first, with how close (px) the tap must be.
 * Thin lines need a near-direct hit so an ordinary "sit here" tap on open ground still reads the spot.
 * The scent cone's fill is left out: it starts at the hunter, where taps to sit are most common.
 */
export const EXPLAINABLE: { id: string; slop: number }[] = [
  { id: 'hour-beds', slop: 10 },
  { id: 'hour-facing', slop: 6 },
  { id: 'hour-trails', slop: 6 },
  { id: 'hour-trails-casing', slop: 6 },
  { id: 'hour-ticks', slop: 4 },
  { id: 'hour-wind', slop: 4 },
  { id: 'hour-scent-line', slop: 4 },
];
export const EXPLAINABLE_LAYERS = EXPLAINABLE.map((e) => e.id);

interface QueryableMap {
  getLayer(id: string): unknown;
  queryRenderedFeatures(
    box: [[number, number], [number, number]],
    opts: { layers: string[] },
  ): { layer: { id: string }; properties: Record<string, unknown> | null }[];
}

/** Finds the mark under a tap, or null. Each layer has its own reach (see EXPLAINABLE). */
export function pickExplainable(map: QueryableMap, point: { x: number; y: number }, noun?: string): Explained | null {
  for (const { id, slop } of EXPLAINABLE) {
    if (!map.getLayer(id)) continue;
    const hits = map.queryRenderedFeatures(
      [
        [point.x - slop, point.y - slop],
        [point.x + slop, point.y + slop],
      ],
      { layers: [id] },
    );
    if (hits.length) return explainFeature(id, hits[0]!.properties ?? {}, noun);
  }
  return null;
}
