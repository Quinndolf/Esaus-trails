import { useCallback, useEffect, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import { BASEMAP_LABELS, nextBasemap, type BasemapId } from './map/basemaps';
import { cardinal, metersToFeet, type LngLat } from './map/geo';
import { ALL_LAYERS, FOLDERS } from './layers/registry';
import { useLayerState } from './layers/useLayerState';
import { useMapLayers } from './layers/useMapLayers';
import { MapView, type LocationMode } from './map/MapView';
import { lastKnownFix, useGeolocation } from './map/useGeolocation';
import { useHeading } from './map/useHeading';
import { EsauPanel, useEsau, useEsauMap } from './esau/ui';
import {
  isAwaitingPinDrop,
  ManualPinPrompt,
  PhotoPinSheet,
  PhotosSheet,
  flyToPin,
  useManualPinDrop,
  usePhotoPinMarkers,
  usePhotoPins,
} from './photos';
import { BasemapIcon, CompassIcon, LayersIcon, LocateFilledIcon, LocateIcon, OfflineIcon, ToolsIcon } from './ui/icons';
import { HourButton, HourPanel } from './hour/HourPanel';
import { LayersSheet } from './ui/LayersSheet';
import { OfflineSheet } from './ui/OfflineSheet';
import { ToolsSheet } from './ui/ToolsSheet';

// Opens on the hunter's last fix; first launch falls back to central Kentucky, where the prototype started.
const FALLBACK: LngLat = [-85.3, 37.6];
const BASEMAP_KEY = 'esau-basemap';

type Sheet = 'layers' | 'offline' | 'tools' | 'photos' | null;

function initialBasemap(): BasemapId {
  try {
    const v = localStorage.getItem(BASEMAP_KEY);
    if (v === 'satellite' || v === 'topo' || v === 'hybrid') return v;
  } catch {
    /* ignore */
  }
  return 'satellite';
}

export function App() {
  const [basemap, setBasemapState] = useState<BasemapId>(initialBasemap);
  const [mode, setMode] = useState<LocationMode>('follow');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [map, setMap] = useState<MLMap | null>(null);
  const [start] = useState(() => lastKnownFix());
  const { fix, status: gps } = useGeolocation();
  const compass = useHeading(mode === 'compass');
  const layers = useLayerState();
  useMapLayers(map, ALL_LAYERS, layers.state);

  const heading = compass.heading ?? fix?.heading ?? null;

  useEffect(() => void usePhotoPins.getState().load(), []);
  usePhotoPinMarkers(map);
  useManualPinDrop(map);

  // Esau: a tap on open map reads that spot, unless a sheet or a photo pin drop owns the tap.
  useEsauMap(map, () => isAwaitingPinDrop() || sheet !== null || usePhotoPins.getState().selectedPinId !== null);
  useEffect(() => {
    useEsau.getState().setHunter(
      fix ? { lat: fix.lngLat[1], lng: fix.lngLat[0], accuracyM: fix.accuracy, headingDeg: heading ?? undefined } : null,
    );
  }, [fix, heading]);
  const photoPins = usePhotoPins((s) => s.pins);
  useEffect(() => {
    useEsau.getState().setPins(
      photoPins.map((p) => ({ id: p.id, kind: 'photo', lat: p.position.lat, lng: p.position.lng, name: p.name, note: p.notes, tags: p.tags })),
    );
  }, [photoPins]);

  // Opening a photo pin (new from EXIF, or picked from the list) brings it on screen.
  const selectedPinId = usePhotoPins((s) => s.selectedPinId);
  useEffect(() => {
    const pin = usePhotoPins.getState().pins.find((p) => p.id === selectedPinId);
    if (!map || !pin) return;
    setMode((m) => (m === 'follow' ? 'free' : m));
    flyToPin(map, pin, { aboveSheet: true });
  }, [map, selectedPinId]);

  const setBasemap = useCallback((b: BasemapId) => {
    setBasemapState(b);
    try {
      localStorage.setItem(BASEMAP_KEY, b);
    } catch {
      /* ignore */
    }
  }, []);

  async function toggleCompass() {
    if (mode === 'compass') {
      setMode('follow');
      return;
    }
    await compass.start();
    setMode('compass');
  }

  const onUserMove = useCallback(() => setMode((m) => (m === 'follow' ? 'free' : m)), []);

  return (
    <div className="app">
      <MapView
        basemap={basemap}
        fix={fix}
        heading={heading}
        mode={mode}
        initialCenter={start?.lngLat ?? FALLBACK}
        initialZoom={start ? 15 : 12}
        onReady={setMap}
        onUserMove={onUserMove}
      />

      <div className="top-bar">
        {mode === 'compass' && (
          <div className="bearing-pill" data-testid="bearing">
            {heading == null ? 'Finding heading…' : `${Math.round(heading)}° ${cardinal(heading)}`}
          </div>
        )}
        {gps === 'denied' && <div className="status-pill warn">Location is off. Allow it in your browser settings.</div>}
        {gps === 'unavailable' && <div className="status-pill warn">Can't get a GPS fix.</div>}
        {gps === 'waiting' && <div className="status-pill">Finding you…</div>}
        {mode === 'compass' && compass.status === 'denied' && <div className="status-pill warn">Compass access was denied.</div>}
        {fix && gps === 'tracking' && (
          <div className="status-pill subtle" data-testid="gps-readout">
            ±{Math.round(metersToFeet(fix.accuracy))} ft
            {fix.altitude != null && ` · ${Math.round(metersToFeet(fix.altitude)).toLocaleString()} ft elev`}
          </div>
        )}
      </div>

      <div className="controls left">
        <button className="fab labeled" onClick={() => setSheet('layers')} aria-label="Map Layers">
          <LayersIcon />
          <span>Layers</span>
        </button>
        <button className="fab labeled" onClick={() => setSheet('offline')} aria-label="Offline Maps">
          <OfflineIcon />
          <span>Offline</span>
        </button>
        <HourButton map={map} />
      </div>

      <button className="fab tools-fab" onClick={() => setSheet('tools')} aria-label="Tools">
        <ToolsIcon />
      </button>

      <div className="controls right">
        <button className="fab labeled" onClick={() => setBasemap(nextBasemap(basemap))} aria-label={`Basemap: ${BASEMAP_LABELS[basemap]}`}>
          <BasemapIcon />
          <span data-testid="basemap-label">{BASEMAP_LABELS[basemap]}</span>
        </button>
        <button
          className={`fab ${mode === 'compass' ? 'is-on' : ''}`}
          onClick={toggleCompass}
          aria-label="Compass mode"
          aria-pressed={mode === 'compass'}
        >
          <CompassIcon />
        </button>
        <button
          className={`fab ${mode !== 'free' ? 'is-on' : ''}`}
          onClick={() => setMode((m) => (m === 'free' ? 'follow' : m))}
          aria-label="Center on me"
        >
          {mode === 'free' ? <LocateIcon /> : <LocateFilledIcon />}
        </button>
      </div>

      <HourPanel map={map} hunter={fix?.lngLat ?? null} />
      <LayersSheet
        open={sheet === 'layers'}
        onClose={() => setSheet(null)}
        basemap={basemap}
        onBasemap={setBasemap}
        folders={FOLDERS}
        state={layers.state}
        onToggle={layers.toggle}
        onOptions={layers.setOptions}
      />
      <OfflineSheet open={sheet === 'offline'} onClose={() => setSheet(null)} map={map} basemap={basemap} />
      <ToolsSheet open={sheet === 'tools'} onClose={() => setSheet(null)} onPhotos={() => setSheet('photos')} />
      <PhotosSheet open={sheet === 'photos'} onClose={() => setSheet(null)} />
      <PhotoPinSheet
        onAskEsau={(input) => {
          usePhotoPins.getState().select(null);
          void useEsau.getState().askPhoto(input);
        }}
      />
      <EsauPanel />
      <ManualPinPrompt />
    </div>
  );
}
