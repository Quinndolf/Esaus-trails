import type { LayerFolder } from './types';
import { DEER_ZONE_COLORS, KY_DEER_SEASON, kyDeerZonesGeoJSON } from './kyDeerZones';

// Layer catalogue. State folders carry `state`; adding a state means adding its folders here.
// Sources marked "prototype" are the exact endpoints the Deer Trails prototype used.

const KY = 'https://kygisserver.ky.gov/arcgis/rest/services/WGS84WM_Services';
const KY_PORTAL = 'https://kygisportalservices.ky.gov/server/rest/services';
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const PADUS_41 = 'https://edits.nationalmap.gov/arcgis/rest/services/PAD-US/PAD_US_4_1/MapServer';
const MRLC = 'https://www.mrlc.gov/geoserver/mrlc_display/wms';

export const FOLDERS: LayerFolder[] = [
  // ---------- Kentucky ----------
  {
    id: 'ky-private',
    name: 'Private Lands',
    state: 'KY',
    layers: [
      {
        id: 'ky-parcels',
        name: 'Property lines',
        description: 'Parcel boundaries from county PVA records. Zoom in close to see them.',
        // prototype
        source: {
          kind: 'xyz',
          tiles: ['https://tiles.arcgis.com/tiles/KzeiCaQsMoeCfoCq/arcgis/rest/services/Regrid_Nationwide_Parcel_Boundaries_v1/MapServer/tile/{z}/{y}/{x}'],
        },
        minzoom: 15,
        maxzoom: 17,
        opacity: 0.92,
        color: '#f4d35e',
        attribution: 'Parcels © Regrid, county PVA',
      },
    ],
  },
  {
    id: 'ky-government',
    name: 'Government Lands',
    state: 'KY',
    layers: [
      {
        id: 'ky-hunting-areas',
        name: 'Public hunting areas',
        description: 'KDFWR wildlife management and public hunting areas.',
        // prototype
        source: { kind: 'arcgis-export', url: `${KY}/Ky_Public_Hunting_Areas_WGS84WM/MapServer`, sublayers: [0, 1] },
        options: [
          { id: 'open', name: 'Hunting areas', value: 1 },
          { id: 'restricted', name: 'Restricted hunting areas', value: 0 },
        ],
        opacity: 0.5,
        color: '#e9724c',
        attribution: 'KDFWR',
      },
      {
        id: 'ky-state-forests',
        name: 'State forests',
        description: 'Kentucky Division of Forestry state forests.',
        // prototype
        source: { kind: 'arcgis-export', url: `${KY}/Ky_StateForests_WGS84WM/MapServer` },
        opacity: 0.55,
        color: '#5da271',
        attribution: 'Kentucky DGI',
      },
      {
        id: 'ky-state-managed',
        name: 'State-managed land',
        description: 'All state-managed parcels in PAD-US: wildlife areas, parks, nature preserves.',
        source: {
          kind: 'arcgis-export',
          url: PADUS_41,
          sublayers: [0],
          filter: { layer: 0, where: "State_Nm = 'KY' AND Mang_Type = 'STAT'" },
        },
        options: [
          { id: 'open', name: 'Open access', where: "Pub_Access = 'OA'" },
          { id: 'restricted', name: 'Restricted access', where: "Pub_Access = 'RA'" },
          { id: 'closed', name: 'Closed', where: "Pub_Access = 'XA'", defaultOn: false },
        ],
        opacity: 0.55,
        color: '#7cb342',
        attribution: 'USGS PAD-US 4.1',
      },
    ],
  },
  {
    id: 'ky-districts',
    name: 'Hunting Districts',
    state: 'KY',
    layers: [
      {
        id: 'ky-deer-zones',
        name: `Deer zones ${KY_DEER_SEASON}`,
        description: `Deer hunting zone of each county for the ${KY_DEER_SEASON} season, from the KDFWR hunting guide map. Dashed counties changed zone this year. County lines are approximate; check the official guide before you hunt.`,
        source: {
          kind: 'geojson',
          load: kyDeerZonesGeoJSON,
          property: 'zone',
          colors: DEER_ZONE_COLORS,
          dashed: 'changed',
        },
        opacity: 0.5,
        color: DEER_ZONE_COLORS[1],
        attribution: `Deer zones: KDFWR hunting guide ${KY_DEER_SEASON}; counties: US Census`,
        options: ([1, 2, 3, 4] as const).map((z) => ({ id: `zone-${z}`, name: `Zone ${z}`, value: z, color: DEER_ZONE_COLORS[z] })),
      },
      {
        id: 'ky-elk-units',
        name: 'Elk hunting units',
        description: 'Elk hunting units in the eastern Kentucky elk zone.',
        source: { kind: 'arcgis-export', url: `${KY}/Ky_Public_Hunting_Areas_WGS84WM/MapServer`, sublayers: [2] },
        opacity: 0.6,
        color: '#a0522d',
        attribution: 'KDFWR',
      },
      {
        id: 'ky-elk-zone',
        name: 'Elk management zone',
        description: 'Boundary of the elk restoration zone.',
        source: { kind: 'arcgis-export', url: `${KY_PORTAL}/Hosted/Elk_mgt_zone_dissolved/MapServer` },
        opacity: 0.6,
        color: '#8d6e63',
        attribution: 'KDFWR',
      },
      {
        id: 'ky-wildlife-regions',
        name: 'Wildlife regions',
        description: 'KDFWR regions: Purchase, Green River, Bluegrass, Northeast, Southeast.',
        source: { kind: 'arcgis-export', url: `${KY_PORTAL}/KDFWR/KY_KDFWR_WildlifeRegionsDissolved_WM/MapServer` },
        opacity: 0.45,
        color: '#9575cd',
        attribution: 'KDFWR',
      },
    ],
  },

  // ---------- Nationwide ----------
  {
    id: 'conditions',
    name: 'Current Conditions',
    layers: [
      {
        id: 'radar',
        name: 'Weather radar',
        description: 'Live NEXRAD base reflectivity, updated every 5 minutes.',
        source: { kind: 'xyz', tiles: ['https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png'] },
        maxzoom: 12,
        opacity: 0.6,
        color: '#26c6da',
        attribution: 'NEXRAD via Iowa Environmental Mesonet',
        live: true,
      },
    ],
  },
  {
    id: 'land-access',
    name: 'Land and Access',
    layers: [
      {
        id: 'public-access',
        name: 'Public access',
        description: 'Public land by access type, nationwide (PAD-US).',
        source: { kind: 'arcgis-export', url: PADUS_41, sublayers: [0], filter: { layer: 0 } },
        options: [
          { id: 'open', name: 'Open access', where: "Pub_Access = 'OA'" },
          { id: 'restricted', name: 'Restricted access', where: "Pub_Access = 'RA'" },
          { id: 'closed', name: 'Closed', where: "Pub_Access = 'XA'", defaultOn: false },
        ],
        opacity: 0.55,
        color: '#4caf50',
        attribution: 'USGS PAD-US 4.1',
      },
      {
        id: 'national-forest',
        name: 'National forests',
        description: 'U.S. Forest Service administrative boundaries.',
        // prototype
        source: { kind: 'arcgis-export', url: 'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_ForestSystemBoundaries_01/MapServer' },
        opacity: 0.8,
        color: '#2e7d32',
        attribution: 'USFS',
      },
      {
        id: 'blm',
        name: 'BLM and surface management',
        description: 'Federal surface management agency lands.',
        // prototype
        source: { kind: 'xyz', tiles: ['https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_Cached_without_PriUnk/MapServer/tile/{z}/{y}/{x}'] },
        opacity: 0.7,
        color: '#fdd835',
        attribution: 'BLM',
      },
    ],
  },
  {
    id: 'roads',
    name: 'Roads',
    layers: [
      {
        id: 'roads',
        name: 'Roads',
        description: 'Highways, county roads and many forest roads.',
        source: { kind: 'xyz', tiles: [`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`] },
        opacity: 1,
        color: '#ffca28',
        attribution: 'Esri',
      },
      {
        id: 'place-names',
        name: 'Place names',
        description: 'Towns, counties and landmarks.',
        source: { kind: 'xyz', tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`] },
        opacity: 1,
        color: '#eceff1',
        attribution: 'Esri',
      },
    ],
  },
  {
    id: 'trails',
    name: 'Trails',
    layers: [
      {
        id: 'hiking-trails',
        name: 'Hiking trails',
        description: 'Marked hiking routes from OpenStreetMap.',
        source: { kind: 'xyz', tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'] },
        maxzoom: 18,
        opacity: 0.9,
        color: '#ef5350',
        attribution: '© Waymarked Trails, OpenStreetMap contributors',
      },
    ],
  },
  {
    id: 'terrain',
    name: 'Terrain',
    layers: [
      {
        id: 'hillshade',
        name: 'Hillshade',
        description: 'Shaded relief that makes ridges, draws and benches pop.',
        // prototype
        source: { kind: 'xyz', tiles: [`${ESRI}/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}`] },
        opacity: 0.38,
        color: '#9e9e9e',
        attribution: 'Esri, USGS',
      },
      {
        id: 'contours',
        name: 'Contour lines',
        description: 'USGS contours. Detail increases as you zoom in.',
        source: { kind: 'arcgis-export', url: 'https://carto.nationalmap.gov/arcgis/rest/services/contours/MapServer' },
        opacity: 0.85,
        color: '#e0b15a',
        attribution: 'USGS',
      },
    ],
  },
  {
    id: 'trees',
    name: 'Trees',
    layers: [
      {
        id: 'land-cover',
        name: 'Land cover',
        description: 'NLCD 2021: forest types, shrub, grass, crops and wetlands.',
        // prototype
        source: { kind: 'wms', url: MRLC, layers: ['mrlc_display:NLCD_2021_Land_Cover_L48'] },
        opacity: 0.55,
        color: '#388e3c',
        attribution: 'MRLC NLCD',
      },
      {
        id: 'canopy',
        name: 'Tree canopy',
        description: 'Percent tree canopy cover, 2021.',
        // prototype
        source: { kind: 'wms', url: MRLC, layers: ['mrlc_display:nlcd_tcc_conus_2021_v2021-4'] },
        opacity: 0.5,
        color: '#1b5e20',
        attribution: 'NLCD tree canopy',
      },
    ],
  },
  {
    id: 'crops',
    name: 'Crops',
    layers: [
      {
        id: 'cropland',
        name: 'Cropland',
        description: 'USDA Cropland Data Layer: what was planted in each field.',
        source: { kind: 'wms', url: 'https://nassgeodata.gmu.edu/CropScapeService/wms_cdlall.cgi', layers: ['cdl_2025'] },
        exclusive: true,
        options: [
          { id: '2025', name: '2025 season', value: 'cdl_2025' },
          { id: '2024', name: '2024 season', value: 'cdl_2024', defaultOn: false },
          { id: '2023', name: '2023 season', value: 'cdl_2023', defaultOn: false },
        ],
        opacity: 0.6,
        color: '#ffd54f',
        attribution: 'USDA NASS CDL',
      },
    ],
  },
  {
    id: 'soil',
    name: 'Soil',
    layers: [
      {
        id: 'soils',
        name: 'Soil map units',
        description: 'NRCS SSURGO soil survey. Zoom in to see unit lines.',
        source: { kind: 'wms', url: 'https://sdmdataaccess.sc.egov.usda.gov/Spatial/SDM.wms', layers: ['mapunitpoly'] },
        options: [
          { id: 'poly', name: 'Map unit areas', value: 'mapunitpoly' },
          { id: 'line', name: 'Map unit lines', value: 'mapunitline' },
        ],
        minzoom: 12,
        opacity: 0.6,
        color: '#8d6e63',
        attribution: 'USDA NRCS SSURGO',
      },
    ],
  },
  {
    id: 'wildlife',
    name: 'Wildlife',
    layers: [
      {
        id: 'refuges',
        name: 'National wildlife refuges',
        description: 'U.S. Fish and Wildlife Service refuges and waterfowl areas.',
        source: {
          kind: 'arcgis-export',
          url: PADUS_41,
          sublayers: [0],
          filter: { layer: 0, where: "Mang_Name = 'FWS'" },
        },
        opacity: 0.55,
        color: '#4fc3f7',
        attribution: 'USGS PAD-US 4.1',
      },
    ],
  },
];

export const ALL_LAYERS = FOLDERS.flatMap((f) => f.layers);

/** Layers on the first time the app opens, matching the prototype's land defaults. */
export const DEFAULT_ON = ['ky-hunting-areas', 'ky-state-forests', 'ky-parcels', 'hillshade'];
