import { useEffect, useRef, useState, type FormEvent } from 'react';
import maplibregl, { type Map as MLMap } from 'maplibre-gl';
import { CloseIcon, SearchIcon } from '../ui/icons';
import { didYouMean, geocode, suggest, type Near, type Place } from './geocode';
import './search.css';

interface Props {
  map: MLMap | null;
  /** Called when the camera leaves the hunter, so the map stops following the dot. */
  onFly?: () => void;
  lookup?: typeof geocode;
  /** Matches while typing. */
  suggestFn?: typeof suggest;
  /** A closest match for a query that found nothing. */
  guessFn?: typeof didYouMean;
}

const TYPING_PAUSE_MS = 400;

/**
 * Scout a place before going: type an address, a town, or "37.6, -85.3", and the map flies there.
 * Esau's reads (tap a spot, Analyze area) work wherever the map is looking.
 */
export function SearchBar({ map, onFly, lookup = geocode, suggestFn = suggest, guessFn = didYouMean }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState<Place | null>(null);
  const [guess, setGuess] = useState<Place | null>(null);
  const ticket = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  // Suggest matches a moment after the hunter stops typing (the service asks for no search on every keystroke).
  useEffect(() => {
    if (!open) return;
    const mine = ++ticket.current;
    setGuess(null);
    if (text.trim().length < 3) {
      setResults(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const c = map?.getCenter();
        const near: Near = c ? [c.lng, c.lat] : null;
        const found = await suggestFn(text, near);
        if (mine !== ticket.current) return;
        setError(null);
        setResults(found.length ? found : null);
      } catch {
        /* suggestions are a nicety; Search still works */
      }
    }, TYPING_PAUSE_MS);
    return () => clearTimeout(t);
  }, [text, open, map, suggestFn]);

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
    ticket.current++; // drop any suggestion still on its way
    setBusy(true);
    setError(null);
    setGuess(null);
    try {
      // Enter takes the top suggestion; with none showing, ask the full search.
      if (results?.length) {
        go(results[0]);
        return;
      }
      const found = await lookup(text);
      if (found.length === 0) {
        setResults(null);
        setError('No match for that.');
        const c = map?.getCenter();
        setGuess(await guessFn(text, c ? [c.lng, c.lat] : null).catch(() => null));
      } else if (found.length === 1) go(found[0]);
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
    setGuess(null);
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
      {guess && (
        <button type="button" className="search-note search-guess" data-testid="search-guess" onClick={() => go(guess)}>
          Did you mean <strong>{guess.label}</strong>?
        </button>
      )}
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
