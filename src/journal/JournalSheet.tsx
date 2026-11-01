import { useMemo } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { useTools } from "../tools/store";
import { analyzeTrack, scentCrossings } from "./analyze";
import { debriefLines } from "./debrief";
import { useJournal, type JournalEntry } from "./store";

/** Past hunts and what the walk looked like. Computed here on the phone from the saved route. */
export function JournalSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const entries = useJournal((s) => s.entries);
  const tracks = useTools((s) => s.tracks);
  const byId = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  return (
    <BottomSheet title="Hunt journal" open={open} onClose={onClose}>
      {!entries.length && <p className="hint">No hunts yet. Stop the tracker when you finish and your hunt shows up here.</p>}
      {entries.map((e) => (
        <Entry key={e.id} e={e} track={e.trackId ? byId.get(e.trackId) : undefined} />
      ))}
    </BottomSheet>
  );
}

function Entry({ e, track }: { e: JournalEntry; track: ReturnType<typeof useTools.getState>["tracks"][number] | undefined }) {
  const lines = useMemo(() => {
    if (!track) return [];
    const a = analyzeTrack(track);
    const crossings = e.windFromDeg == null ? [] : scentCrossings(track, { windFromDeg: () => e.windFromDeg!, beds: e.beds, trails: e.trails });
    return debriefLines(a, { species: e.species ?? "whitetail", weapon: e.weapon }, crossings);
  }, [e, track]);
  return (
    <article className="journal-entry">
      <strong>
        {e.date}
        {e.species ? ` · ${e.species.replace("_", " ")}` : ""}
      </strong>
      <p>{e.snagged === "yes" ? `Snagged: ${e.what || "yes"}` : e.snagged === "no" ? "Nothing this time" : "Didn't say"}</p>
      {track ? lines.map((l) => <p key={l}>{l}</p>) : <p className="hint">This hunt has no route saved.</p>}
    </article>
  );
}
