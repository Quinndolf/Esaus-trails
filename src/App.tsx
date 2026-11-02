import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import type { BasemapId } from './map/basemaps';
import { cardinal, type LngLat } from './map/geo';
import { ALL_LAYERS, foldersFor, scopeLayerState } from './layers/registry';
import { offlineOverlays } from './layers/offline';
import { useLayerState } from './layers/useLayerState';
import { useMapLayers } from './layers/useMapLayers';
import { MapView, type LocationMode } from './map/MapView';
import { currentFix, gpsWanted, lastKnownFix, useGeolocation } from './map/useGeolocation';
import { usePageVisible } from './map/usePageVisible';
import { useHeading } from './map/useHeading';
import { EsauPanel, registerAnalyzer, useEsau, useEsauMap } from './esau/ui';
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
import { ToolBar, TrackerChip, WaypointSheet, isToolCapturingTaps, useToolLayers, useTools } from './tools';
import { CompassIcon, LayersIcon, LocateFilledIcon, LocateIcon, ToolsIcon } from './ui/icons';
import { CallsSheet } from './calls/CallsSheet';
import { GinsengGearSheet, GinsengHowToSheet, GinsengPill, GinsengRulesSheet, useGinsengLayer } from './ginseng/GinsengMode';
import { useGinseng } from './ginseng/store';
import { hourScope } from './hour/scope';
import { bboxAround } from './hour/ground';
import { useHour } from './hour/store';
import { LayersSheet } from './ui/LayersSheet';
import { OfflineSheet } from './ui/OfflineSheet';
import { ToolsSheet } from './ui/ToolsSheet';
import { AnalyzePill } from './home/AnalyzePill';
import { AdvisoryBanner, RangePill, useSitSpotMarkers } from './home/MapExtras';
import { AnimalChip } from './home/AnimalChip';
import { ExitPrompt } from './home/ExitPrompt';
import { JournalSheet } from './journal/JournalSheet';
import { useReplayMarker } from './journal/useReplayMarker';
import { useWindLog } from './journal/useWindLog';
import { HourBar } from './home/HourBar';
import { nextLocation } from './home/location';
import { Tutorial } from './home/Tutorial';
import { MarksSheet, UndoToast } from './marks/MarksSheet';
import { useWeapon } from './home/weapon';
import './home/home.css';

// Opens on the hunter's last fix; first launch falls back to central Kentucky, where the prototype started.
const FALLBACK: LngLat = [-85.3, 37.6];
const BASEMAP_KEY = 'esau-basemap';

type Sheet = 'layers' | 'offline' | 'tools' | 'photos' | 'saved' | 'calls' | null | 'journal';

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
  const recording = useTools((s) => s.recording != null);
  const visible = usePageVisible();
  useWindLog(recording);
  const replayAt = useReplayMarker(map);
  const gpsOn = gpsWanted({ mode, recording, visible });
  const { fix, status: gps } = useGeolocation(gpsOn);
  const compass = useHeading(mode === 'compass');
  const layers = useLayerState();
  // Layers meant for another animal are switched off on the map and left out of offline saves.
  const species = useEsau((s) => s.species);
  const scopedState = useMemo(() => scopeLayerState(layers.state, species), [layers.state, species]);
  const folders = useMemo(() => foldersFor(species), [species]);
  useMapLayers(map, ALL_LAYERS, scopedState);
  const offlineLayers = useMemo(() => offlineOverlays(scopedState), [scopedState]);

  const heading = compass.heading ?? fix?.heading ?? null;

  useEffect(() => registerAnalyzer(), []);
  useEffect(() => void usePhotoPins.getState().load(), []);
  usePhotoPinMarkers(map);
  useManualPinDrop(map);

  useEffect(() => void useTools.getState().load(), []);
  useToolLayers(map);
  useSitSpotMarkers(map);
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
    // GPS may be off to save battery, so take one fresh reading for this mark.
    const here = gpsOn ? fix : ((await currentFix()) ?? null);
    if (!here) {
      setNotice('No GPS fix yet. Step into the open and try again.');
      return;
    }
    const t = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    await useTools.getState().addWaypoint({ position: here.lngLat, altitude: here.altitude, icon: 'x', name: `Marked ${t}` });
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

  async function onLocation() {
    const next = nextLocation(mode);
    if (next === 'compass') await compass.start();
    setMode(next);
  }

  const onUserMove = useCallback(() => setMode((m) => (m === 'follow' ? 'free' : m)), []);

  // Ask "Did you snag anything?" when the hunter comes back after leaving the app, or stops the tracker.
  const [exitOpen, setExitOpen] = useState(false);
  const wasRecording = useRef(false);
  useEffect(() => {
    if (wasRecording.current && !recording) setExitOpen(true);
    wasRecording.current = recording;
  }, [recording]);
  useEffect(() => {
    const opened = Date.now();
    let left = false;
    const onVis = () => {
      if (document.visibilityState === 'hidden') left = Date.now() - opened > 10 * 60e3 && useEsau.getState().species != null;
      else if (left) {
        left = false;
        setExitOpen(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Keep the weapon legal for the animal.
  useEffect(() => useWeapon.getState().ensureFor(species), [species]);

  const hasHourBar = hourWanted;
  const problems = [
    gps === 'denied' && 'Location is off. Allow it in your browser settings.',
    gps === 'unavailable' && "Can't get a GPS fix.",
    mode === 'compass' && compass.status === 'denied' && 'Compass access was denied.',
    notice,
  ].filter((m): m is string => !!m);

  return (
    <div className={`app ${hasHourBar ? 'has-hour-bar' : ''}`}>
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

      <AnimalChip />

      <div className="top-bar">
        {mode === 'compass' && (
          <div className="bearing-pill" data-testid="bearing">
            {heading == null ? 'Finding heading…' : `${Math.round(heading)}° ${cardinal(heading)}`}
          </div>
        )}
        <GinsengPill map={map} />
        {problems.map((m) => (
          <div key={m} className="status-line" data-testid="status-line">
            {m}
          </div>
        ))}
      </div>

      <AdvisoryBanner />
      <RangePill />
      <AnalyzePill map={map} />

      <button className="frost-btn tools-btn" onClick={() => setSheet('tools')} aria-label="Tools">
        <ToolsIcon />
      </button>

      <div className="home-stack">
        <button className="frost-btn" onClick={() => setSheet('layers')} aria-label="Map Layers">
          <LayersIcon />
        </button>
        <button
          className={`frost-btn ${mode !== 'free' ? 'is-on' : ''}`}
          onClick={() => void onLocation()}
          aria-label={mode === 'follow' ? 'My location. Tap for compass' : mode === 'compass' ? 'Compass on. Tap to turn off' : 'My location'}
          aria-pressed={mode !== 'free'}
        >
          {mode === 'compass' ? <CompassIcon /> : mode === 'free' ? <LocateIcon /> : <LocateFilledIcon />}
        </button>
      </div>

      <HourBar map={map} hunter={fix?.lngLat ?? null} facing={mode === 'compass' ? heading : null} />
      <LayersSheet
        open={sheet === 'layers'}
        onClose={() => setSheet(null)}
        basemap={basemap}
        onBasemap={setBasemap}
        folders={folders}
        state={layers.state}
        onToggle={layers.toggle}
        onOptions={layers.setOptions}
        onDownload={() => setSheet('offline')}
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
        onDone={() => setExitOpen(true)}
        onJournal={() => setSheet('journal')}
      />
      <JournalSheet open={sheet === 'journal'} onClose={() => setSheet(null)} onReplay={replayAt} />
      <GinsengRulesSheet />
      <GinsengHowToSheet />
      <GinsengGearSheet />
      <CallsSheet open={sheet === 'calls'} onClose={() => setSheet(null)} species={species} />
      <MarksSheet open={sheet === 'saved'} onClose={() => setSheet(null)} map={map} />
      <UndoToast />
      <WaypointSheet />
      <ToolBar />
      <TrackerChip />
      <PhotosSheet open={sheet === 'photos'} onClose={() => setSheet(null)} />
      <PhotoPinSheet />
      <EsauPanel />
      <ManualPinPrompt />
      <Tutorial />
      <ExitPrompt open={exitOpen} onClose={() => setExitOpen(false)} />
    </div>
  );
}
