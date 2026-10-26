import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import { BASEMAP_LABELS, nextBasemap, type BasemapId } from './map/basemaps';
import { cardinal, metersToFeet, type LngLat } from './map/geo';
import { ALL_LAYERS, foldersFor, scopeLayerState } from './layers/registry';
import { offlineOverlays } from './layers/offline';
import { useLayerState } from './layers/useLayerState';
import { useMapLayers } from './layers/useMapLayers';
import { MapView, type LocationMode } from './map/MapView';
import { lastKnownFix, useGeolocation } from './map/useGeolocation';
import { useHeading } from './map/useHeading';
import { EsauPanel, HuntPill, SpeciesPicker, useEsau, useEsauMap } from './esau/ui';
import { callsFor, CALL_GROUP_TITLE } from './calls/catalog';
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
import type { PinKind } from './esau/types';
import { SavedSheet, ToolBar, TrackerChip, WaypointSheet, isToolCapturingTaps, useToolLayers, useTools, type WaypointIcon } from './tools';
import { BasemapIcon, CompassIcon, LayersIcon, LocateFilledIcon, LocateIcon, OfflineIcon, ToolsIcon } from './ui/icons';
import { CallButton } from './calls/CallButton';
import { CallsSheet } from './calls/CallsSheet';
import { GinsengHowToSheet, GinsengPill, GinsengRulesSheet, useGinsengLayer } from './ginseng/GinsengMode';
import { useGinseng } from './ginseng/store';
import { HourButton, HourPanel } from './hour/HourPanel';
import { hourScope } from './hour/scope';
import { bboxAround } from './hour/ground';
import { useHour } from './hour/store';
import { LayersSheet } from './ui/LayersSheet';
import { OfflineSheet } from './ui/OfflineSheet';
import { ToolsSheet } from './ui/ToolsSheet';

// Opens on the hunter's last fix; first launch falls back to central Kentucky, where the prototype started.
const FALLBACK: LngLat = [-85.3, 37.6];
const BASEMAP_KEY = 'esau-basemap';

/** Waypoint icons Esau treats as ground truth about the property. */
const ESAU_PIN_KIND: Partial<Record<WaypointIcon, PinKind>> = {
  food: 'food',
  water: 'water',
  bed: 'bed',
  stand: 'stand',
  blind: 'stand',
  rub: 'sign',
  scrape: 'sign',
  trail: 'sign',
};

type Sheet = 'layers' | 'offline' | 'tools' | 'photos' | 'saved' | 'calls' | null;

function initialBasemap(): BasemapId {
  try {
    const v = localStorage.getItem(BASEMAP_KEY);
    if (v === 'satellite' || v === 'topo' || v === 'hybrid' || v === 'streets') return v;
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
  // Layers meant for another animal are switched off on the map and left out of offline saves.
  const species = useEsau((s) => s.species);
  const scopedState = useMemo(() => scopeLayerState(layers.state, species), [layers.state, species]);
  const folders = useMemo(() => foldersFor(species), [species]);
  useMapLayers(map, ALL_LAYERS, scopedState);
  const offlineLayers = useMemo(() => offlineOverlays(scopedState), [scopedState]);

  const heading = compass.heading ?? fix?.heading ?? null;

  useEffect(() => void usePhotoPins.getState().load(), []);
  usePhotoPinMarkers(map);
  useManualPinDrop(map);

  useEffect(() => void useTools.getState().load(), []);
  useToolLayers(map);
  useGinsengLayer(map);
  const ginsengOn = species === 'ginseng';
  // Picking Ginseng from Esau's animal chips counts as entering the mode too: rules first, then the ground.
  useEffect(() => {
    if (!ginsengOn || !map) return;
    const c = map.getCenter();
    useGinseng.getState().enter([c.lng, c.lat]);
  }, [ginsengOn, map]);
  // The hour slider is on the map from the start (like the Grok prototype): it opens itself once an animal is chosen.
  const hourWanted = hourScope(species) != null;
  const hourIdle = useHour((s) => s.status === 'idle');
  useEffect(() => {
    if (!map || !hourWanted || !hourIdle) return;
    const c = start?.lngLat ?? [map.getCenter().lng, map.getCenter().lat];
    void useHour.getState().load(bboxAround(c as LngLat));
  }, [map, hourWanted, hourIdle, start]);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  // Feed GPS into the route tracker while it records.
  useEffect(() => {
    if (fix) useTools.getState().addFix({ lngLat: fix.lngLat, accuracy: fix.accuracy, altitude: fix.altitude, time: fix.time });
  }, [fix]);

  // Opening a waypoint brings it on screen above the sheet.
  const selectedWaypointId = useTools((s) => s.selectedWaypointId);
  useEffect(() => {
    const wp = useTools.getState().waypoints.find((w) => w.id === selectedWaypointId);
    if (!map || !wp) return;
    setMode((m) => (m === 'follow' ? 'free' : m));
    const h = map.getContainer().clientHeight;
    map.flyTo({ center: wp.position, zoom: Math.max(map.getZoom(), 16), offset: [0, -h * 0.4] });
  }, [map, selectedWaypointId]);

  async function markMyLocation() {
    if (!fix) {
      setNotice('No GPS fix yet. Step into the open and try again.');
      return;
    }
    const t = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    await useTools.getState().addWaypoint({ position: fix.lngLat, altitude: fix.altitude, icon: 'x', name: `Marked ${t}` });
  }

  // Esau: a tap on open map reads that spot, unless a sheet, a photo pin drop or a map tool owns the tap.
  useEsauMap(
    map,
    () =>
      isAwaitingPinDrop() ||
      isToolCapturingTaps() ||
      sheet !== null ||
      usePhotoPins.getState().selectedPinId !== null ||
      useTools.getState().selectedWaypointId !== null,
  );
  useEffect(() => {
    useEsau.getState().setHunter(
      fix ? { lat: fix.lngLat[1], lng: fix.lngLat[0], accuracyM: fix.accuracy, headingDeg: heading ?? undefined } : null,
    );
  }, [fix, heading]);
  // Esau reads photo pins and the hunter's food, water, bed, stand and sign waypoints.
  const photoPins = usePhotoPins((s) => s.pins);
  const waypoints = useTools((s) => s.waypoints);
  useEffect(() => {
    useEsau.getState().setPins([
      ...photoPins.map((p) => ({ id: p.id, kind: 'photo' as const, lat: p.position.lat, lng: p.position.lng, name: p.name, note: p.notes, tags: p.tags })),
      ...waypoints.flatMap((w) => {
        const kind = ESAU_PIN_KIND[w.icon];
        return kind ? [{ id: w.id, kind, lat: w.position[1], lng: w.position[0], name: w.name, note: w.notes }] : [];
      }),
    ]);
  }, [photoPins, waypoints]);

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
        <HuntPill />
        <GinsengPill map={map} />
        {notice && <div className="status-pill warn">{notice}</div>}
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
        <button className="fab labeled" onClick={() => setSheet('offline')} aria-label="Download maps for offline use">
          <OfflineIcon />
          <span>Save maps</span>
        </button>
        <HourButton map={map} />
      </div>

      <button className="fab tools-fab" onClick={() => setSheet('tools')} aria-label="Tools">
        <ToolsIcon />
      </button>

      <div className="controls right">
        <CallButton />
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
        folders={folders}
        state={layers.state}
        onToggle={layers.toggle}
        onOptions={layers.setOptions}
      />
      <OfflineSheet open={sheet === 'offline'} onClose={() => setSheet(null)} map={map} basemap={basemap} overlays={offlineLayers} />
      <ToolsSheet
        open={sheet === 'tools'}
        onClose={() => setSheet(null)}
        onPhotos={() => setSheet('photos')}
        onSaved={() => setSheet('saved')}
        onCalls={() => setSheet('calls')}
        hasCalls={callsFor(species).length > 0}
        callsHint={callsFor(species).length ? `${CALL_GROUP_TITLE[callsFor(species)[0].species]} calls: how to, credits` : ''}
        onMarkLocation={() => void markMyLocation()}
      />
      <GinsengRulesSheet />
      <GinsengHowToSheet />
      <CallsSheet open={sheet === 'calls'} onClose={() => setSheet(null)} species={species} />
      <SavedSheet open={sheet === 'saved'} onClose={() => setSheet(null)} map={map} />
      <WaypointSheet />
      <ToolBar />
      <TrackerChip />
      <PhotosSheet open={sheet === 'photos'} onClose={() => setSheet(null)} />
      <PhotoPinSheet
        onAskEsau={(input) => {
          usePhotoPins.getState().select(null);
          void useEsau.getState().askPhoto(input);
        }}
      />
      <EsauPanel />
      <ManualPinPrompt />
      <SpeciesPicker />
    </div>
  );
}
