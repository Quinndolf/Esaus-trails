import type { StyleSpecification } from 'maplibre-gl';

export type BasemapId = 'satellite' | 'topo' | 'hybrid';

export const BASEMAP_ORDER: BasemapId[] = ['satellite', 'topo', 'hybrid'];

export const BASEMAP_LABELS: Record<BasemapId, string> = {
  satellite: 'Satellite',
  topo: 'Topo',
  hybrid: 'Hybrid',
};

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';

// Raster sources shared by every style. Swapping basemaps only flips layer
// visibility, so the GPS and drawing layers on top are never torn down.
export const RASTER_SOURCES = {
  imagery: {
    tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
    maxzoom: 19,
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
  },
  topo: {
    tiles: [`${ESRI}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`],
    maxzoom: 19,
    attribution: 'Topo © Esri, USGS, NOAA',
  },
  roads: {
    tiles: [`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`],
    maxzoom: 19,
    attribution: 'Roads © Esri',
  },
  labels: {
    tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`],
    maxzoom: 19,
    attribution: 'Labels © Esri',
  },
} as const;

export type RasterSourceId = keyof typeof RASTER_SOURCES;

export const BASEMAP_LAYERS: Record<BasemapId, RasterSourceId[]> = {
  satellite: ['imagery'],
  topo: ['topo'],
  hybrid: ['imagery', 'roads', 'labels'],
};

export function nextBasemap(current: BasemapId): BasemapId {
  const i = BASEMAP_ORDER.indexOf(current);
  return BASEMAP_ORDER[(i + 1) % BASEMAP_ORDER.length];
}

export function buildStyle(initial: BasemapId): StyleSpecification {
  const ids = Object.keys(RASTER_SOURCES) as RasterSourceId[];
  return {
    version: 8,
    sources: Object.fromEntries(
      ids.map((id) => [id, { type: 'raster', tileSize: 256, ...RASTER_SOURCES[id], tiles: [...RASTER_SOURCES[id].tiles] }]),
    ),
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#1b2116' } },
      ...ids.map((id) => ({
        id: `base-${id}`,
        type: 'raster' as const,
        source: id,
        layout: { visibility: BASEMAP_LAYERS[initial].includes(id) ? ('visible' as const) : ('none' as const) },
      })),
    ],
  };
}

/** Every tile URL template, used by the offline downloader. */
export function templatesFor(basemap: BasemapId): string[] {
  return BASEMAP_LAYERS[basemap].map((id) => RASTER_SOURCES[id].tiles[0]);
}
