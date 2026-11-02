import { useEffect } from "react";
import { useEsau, nearestHour } from "../esau/ui/store";
import { logWind } from "./windLog";

const EVERY_MS = 15 * 60e3;

/** While the tracker runs, note the wind every 15 minutes. Reads the weather Esau already has; fetches nothing. */
export function useWindLog(recording: boolean): void {
  useEffect(() => {
    if (!recording) return;
    const note = () => {
      const g = useEsau.getState().grid;
      const h = g?.weather.hours[nearestHour(g, new Date())];
      if (h) logWind({ at: Date.now(), fromDeg: h.windFrom, mph: h.windMph });
    };
    note();
    const id = setInterval(note, EVERY_MS);
    return () => clearInterval(id);
  }, [recording]);
}
