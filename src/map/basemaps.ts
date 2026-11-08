import type { StyleSpecification } from 'maplibre-gl';

export type BasemapId = 'satellite' | 'topo' | 'hybrid' | 'streets';

export const BASEMAP_ORDER: BasemapId[] = ['satellite', 'topo', 'hybrid', 'streets'];

export const BASEMAP_LABELS: Record<BasemapId, string> = {
  satellite: 'Satellite',
  topo: 'Topo',
  hybrid: 'Hybrid',
  streets: 'Streets',
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
  streets: {
    tiles: [`${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`],
    maxzoom: 19,
    attribution: 'Streets © Esri, HERE, Garmin, OpenStreetMap contributors',
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
  streets: ['streets'],
};

export function nextBasemap(current: BasemapId): BasemapId {
  const i = BASEMAP_ORDER.indexOf(current);
  return BASEMAP_ORDER[(i + 1) % BASEMAP_ORDER.length];
}

/** Free elevation tiles (AWS Open Data, Terrarium encoding, no key). Drives the shaded relief and the 3D view. */
export const DEM_SOURCE = {
  type: 'raster-dem' as const,
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium' as const,
  tileSize: 256,
  maxzoom: 14,
  attribution: 'Terrain: Mapzen, USGS, NASA SRTM',
};

export function buildStyle(initial: BasemapId): StyleSpecification {
  const ids = Object.keys(RASTER_SOURCES) as RasterSourceId[];
  return {
    version: 8,
    sources: {
      ...Object.fromEntries(
        ids.map((id) => [id, { type: 'raster', tileSize: 256, ...RASTER_SOURCES[id], tiles: [...RASTER_SOURCES[id].tiles] }]),
      ),
      dem: { ...DEM_SOURCE, tiles: [...DEM_SOURCE.tiles] },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#1b2116' } },
      ...ids.map((id) => ({
        id: `base-${id}`,
        type: 'raster' as const,
        source: id,
        layout: { visibility: BASEMAP_LAYERS[initial].includes(id) ? ('visible' as const) : ('none' as const) },
      })),
      // Soft shaded relief over the imagery so ridges and hollows read like onX. Overlays are added above it.
      {
        id: 'hillshade',
        type: 'hillshade' as const,
        source: 'dem',
        paint: {
          'hillshade-exaggeration': 0.35,
          'hillshade-shadow-color': 'rgba(10, 18, 8, 0.55)',
          'hillshade-highlight-color': 'rgba(255, 255, 240, 0.35)',
          'hillshade-accent-color': 'rgba(10, 18, 8, 0.2)',
        },
      },
    ],
  };
}

/** Every tile URL template, used by the offline downloader. */
export function templatesFor(basemap: BasemapId): string[] {
  return BASEMAP_LAYERS[basemap].map((id) => RASTER_SOURCES[id].tiles[0]);
}
