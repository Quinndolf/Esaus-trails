import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { useTools } from "../tools/store";
import type { Track } from "../tools/types";
import { cardinal, distance, formatDistance, formatDuration, type LngLat } from "../map/geo";
import { analyzeTrack, scentCrossings } from "./analyze";
import { debriefLines } from "./debrief";
import { useJournal, type JournalEntry } from "./store";
import { windAt } from "./windLog";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with where the hunter was while replaying, and null when the replay closes. */
  onReplay?: (at: LngLat | null) => void;
  /** Close the sheet and frame this route on the map. */
  onShow?: (points: LngLat[]) => void;
}

/** Past hunts and what the walk looked like. Computed here on the phone from the saved route. */
export function JournalSheet({ open, onClose, onReplay, onShow }: Props) {
  const entries = useJournal((s) => s.entries);
  const tracks = useTools((s) => s.tracks);
  const byId = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  useEffect(() => {
    if (!open) onReplay?.(null);
  }, [open, onReplay]);
  const linked = new Set(entries.map((e) => e.trackId));
  const loose = tracks.filter((t) => !linked.has(t.id));
  return (
    <BottomSheet title="Hunt journal" open={open} onClose={onClose}>
      {!entries.length && !loose.length && <p className="hint">No hunts yet. Stop the tracker when you finish and your hunt shows up here.</p>}
      {entries.map((e) => (
        <Entry key={e.id} e={e} track={e.trackId ? byId.get(e.trackId) : undefined} onReplay={onReplay} onShow={onShow} />
      ))}
      {loose.length > 0 && <h3 className="journal-subhead">Other tracked walks</h3>}
      {loose.map((t) => (
        <Entry key={t.id} e={looseEntry(t)} track={t} onReplay={onReplay} onShow={onShow} loose />
      ))}
    </BottomSheet>
  );
}

/** A saved route nobody wrote up: shown with the same replay, minus the snag line. */
const looseEntry = (t: Track): JournalEntry => ({
  id: `loose-${t.id}`,
  trackId: t.id,
  date: new Date(t.startedAt).toLocaleDateString("en-CA"),
  species: null,
  weapon: null,
  snagged: null,
  windFromDeg: null,
  beds: [],
  trails: [],
});

const windFor = (e: JournalEntry) => (at: number): number => windAt(e.wind ?? [], at)?.fromDeg ?? e.windFromDeg ?? NaN;
const hasWind = (e: JournalEntry) => (e.wind?.length ?? 0) > 0 || e.windFromDeg != null;

function Entry({ e, track, onReplay, onShow, loose }: { e: JournalEntry; track: Track | undefined; onReplay?: (at: LngLat | null) => void; onShow?: (points: LngLat[]) => void; loose?: boolean }) {
  const [replaying, setReplaying] = useState(false);
  const crossings = useMemo(
    () => (track && hasWind(e) && e.beds.length + e.trails.length > 0 ? scentCrossings(track, { windFromDeg: (_p, at) => windFor(e)(at), beds: e.beds, trails: e.trails }) : []),
    [e, track],
  );
  const lines = useMemo(() => {
    if (!track) return [];
    const checked = hasWind(e) && e.beds.length + e.trails.length > 0;
    return debriefLines(analyzeTrack(track), { species: e.species ?? "whitetail", weapon: e.weapon }, crossings, checked);
  }, [e, track, crossings]);
  return (
    <article className="journal-entry">
      <strong>
        {e.date}
        {e.species ? ` · ${e.species.replace("_", " ")}` : ""}
      </strong>
      {!loose && <p>{e.snagged === "yes" ? `Snagged: ${e.what || "yes"}` : e.snagged === "no" ? "Nothing this time" : "Didn't say"}</p>}
      {track && (
        <p data-testid="journal-route">
          {track.name} · {formatDistance(track.distance)} · {formatDuration(track.endedAt - track.startedAt)}
        </p>
      )}
      {track && !loose && lines.map((l, i) => <p key={i}>{l}</p>)}
      {!track && <p className="hint">This hunt has no route saved.</p>}
      {track && onShow && track.points.some((q) => q.lngLat.every(Number.isFinite)) && (
        <button className="link-btn" data-testid="journal-show" onClick={() => onShow(track.points.map((q) => q.lngLat).filter((l) => l.every(Number.isFinite)))}>
          Show on map
        </button>
      )}
      {track && track.points.filter((q) => q.lngLat.every(Number.isFinite)).length > 1 && !replaying && (
        <button className="link-btn" data-testid="replay-open" onClick={() => setReplaying(true)}>
          Replay this walk
        </button>
      )}
      {track && replaying && (
        <Replay
          e={e}
          track={track}
          crossings={crossings}
          onClose={() => {
            setReplaying(false);
            onReplay?.(null);
          }}
          onAt={onReplay}
        />
      )}
    </article>
  );
}

function Replay({ e, track, crossings, onClose, onAt }: { e: JournalEntry; track: Track; crossings: { at: number }[]; onClose: () => void; onAt?: (at: LngLat | null) => void }) {
  const pts = useMemo(() => track.points.filter((q) => q.lngLat.every(Number.isFinite)), [track]);
  const [i, setI] = useState(0);
  const p = pts[Math.min(i, pts.length - 1)]!;
  useEffect(() => {
    onAt?.(p.lngLat);
  }, [p, onAt]);
  const sample = windAt(e.wind ?? [], p.time);
  const wind = sample ?? (e.windFromDeg != null ? { fromDeg: e.windFromDeg, mph: null as number | null } : null);
  const fromStart = Math.round(distance(pts[0]!.lngLat, p.lngLat) * 1.09361);
  const so = crossings.filter((c) => c.at <= p.time).length;
  return (
    <div className="journal-replay">
      <input
        type="range"
        min={0}
        max={pts.length - 1}
        step={1}
        value={i}
        data-testid="replay-slider"
        aria-label="Move through the walk"
        onChange={(ev) => setI(Number(ev.target.value))}
        onInput={(ev) => setI(Number((ev.target as HTMLInputElement).value))}
      />
      <p>
        {Number.isFinite(p.time) ? new Date(p.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Time unknown"} · {fromStart} yd from where you started
      </p>
      <p data-testid="replay-wind">
        {wind ? `${wind.mph == null ? "Wind at the end of the hunt" : "Wind then"}: ${wind.mph == null ? "" : `${Math.round(wind.mph)} mph `}from the ${cardinal(wind.fromDeg)}, so your scent went ${cardinal(wind.fromDeg + 180)}.` : "No wind on file for this time, so no scent read."}
      </p>
      <p data-testid="replay-cross">Beds or trails your scent reached so far: {so}</p>
      <button className="link-btn" data-testid="replay-close" onClick={onClose}>
        Close replay
      </button>
    </div>
  );
}
