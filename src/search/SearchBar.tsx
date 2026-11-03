import { useEffect, useRef, useState, type FormEvent } from 'react';
import maplibregl, { type Map as MLMap } from 'maplibre-gl';
import { CloseIcon, SearchIcon } from '../ui/icons';
import { geocode, type Place } from './geocode';
import './search.css';

interface Props {
  map: MLMap | null;
  /** Called when the camera leaves the hunter, so the map stops following the dot. */
  onFly?: () => void;
  lookup?: typeof geocode;
}

/**
 * Scout a place before going: type an address, a town, or "37.6, -85.3", and the map flies there.
 * Esau's reads (tap a spot, Analyze area) work wherever the map is looking.
 */
export function SearchBar({ map, onFly, lookup = geocode }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState<Place | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  // The searched spot stays marked until the hunter clears it.
  useEffect(() => {
    if (!map || !pin) return;
    const el = document.createElement('div');
    el.className = 'search-pin';
    el.title = pin.label;
    const m = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([pin.lng, pin.lat]).addTo(map);
    return () => void m.remove();
  }, [map, pin]);

  function go(p: Place) {
    if (!map) return;
    onFly?.();
    setPin(p);
    setResults(null);
    setOpen(false);
    if (p.bbox) map.fitBounds(p.bbox, { padding: 60, maxZoom: 16, duration: 1200 });
    else map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 16), duration: 1200 });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const found = await lookup(text);
      if (found.length === 0) setError('Nothing found. Try a town, a road, or latitude and longitude.');
      else if (found.length === 1) go(found[0]);
      else setResults(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setText('');
    setResults(null);
    setError(null);
    setPin(null);
    input.current?.focus();
  }

  if (!open) {
    return (
      <button
        className={`frost-btn search-btn ${pin ? 'is-on' : ''}`}
        data-testid="search-open"
        aria-label="Search a place or address"
        onClick={() => setOpen(true)}
      >
        <SearchIcon />
      </button>
    );
  }

  return (
    <div className="search-wrap" data-testid="search-bar">
      <form className="search-field" onSubmit={submit} role="search">
        <SearchIcon />
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Address, place, or lat, long"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          aria-label="Search a place or address"
        />
        {(text || pin) && (
          <button type="button" className="search-x" aria-label="Clear search" data-testid="search-clear" onClick={clear}>
            <CloseIcon />
          </button>
        )}
        <button type="button" className="search-done" onClick={() => setOpen(false)}>
          Done
        </button>
      </form>
      {busy && <div className="search-note">Searching…</div>}
      {error && <div className="search-note is-error" role="alert">{error}</div>}
      {results && (
        <ul className="search-results" role="listbox">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" role="option" aria-selected={false} data-testid="search-result" onClick={() => go(r)}>
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
