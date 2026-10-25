/** Where a layer's pixels come from. Every kind ends up as a MapLibre raster source. */
export type LayerSource =
  | { kind: 'xyz'; tiles: string[]; tileSize?: number }
  /** ArcGIS MapServer drawn on the fly through /export. `sublayers` are the ids to show. */
  | {
      kind: 'arcgis-export';
      url: string;
      sublayers?: number[];
      /** Definition query applied to one sub-layer; view options with `where` are OR-ed onto it. */
      filter?: { layer: number; where?: string };
    }
  /** OGC WMS 1.1.1 GetMap in Web Mercator. `layers` are WMS layer names. */
  | { kind: 'wms'; url: string; layers: string[]; styles?: string }
  /**
   * Polygons shipped with the app (so they work offline), filled by one property. View options with a
   * `value` show only features whose property equals it. `dashed` outlines features where that property is true.
   */
  | {
      kind: 'geojson';
      load: () => Promise<GeoJSON.FeatureCollection>;
      property: string;
      colors: Record<string, string>;
      dashed?: string;
    };

/** A "view options" choice. Picking options narrows which sub-layers draw. */
export interface ViewOption {
  id: string;
  name: string;
  /** ArcGIS sub-layer id or WMS layer name this option turns on. */
  value?: number | string;
  /** For an ArcGIS `filter` layer: the SQL clause this option adds. */
  where?: string;
  color?: string;
  defaultOn?: boolean;
}

export interface LayerDef {
  id: string;
  name: string;
  description: string;
  source: LayerSource;
  opacity?: number;
  minzoom?: number;
  maxzoom?: number;
  attribution?: string;
  /** Swatch shown on the row. */
  color?: string;
  options?: ViewOption[];
  /** Only one view option at a time (e.g. picking a year). */
  exclusive?: boolean;
  /** Set when the layer can't load yet, e.g. a missing data key. Shown instead of the toggle. */
  unavailable?: string;
  /** Live data (e.g. radar) that is stale by the time you'd use it offline, so downloads skip it. */
  live?: boolean;
}

export interface LayerFolder {
  id: string;
  name: string;
  /** Two-letter state code for state folders; absent for nationwide folders. */
  state?: string;
  layers: LayerDef[];
}

export interface LayerState {
  on: Record<string, boolean>;
  /** Selected view option ids per layer. Missing means the defaults. */
  options: Record<string, string[]>;
}
