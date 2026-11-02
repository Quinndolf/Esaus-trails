import { useCallback, useEffect, useRef } from "react";
import maplibregl, { type Map as MLMap } from "maplibre-gl";
import type { LngLat } from "../map/geo";

/** One marker that shows where the hunter was during a replay. Returns the setter to hand to the journal. */
export function useReplayMarker(map: MLMap | null): (at: LngLat | null) => void {
  const marker = useRef<maplibregl.Marker | null>(null);
  useEffect(() => () => void marker.current?.remove(), [map]);
  return useCallback(
    (at) => {
      if (!map || !at) {
        marker.current?.remove();
        marker.current = null;
        return;
      }
      if (!marker.current) {
        const el = document.createElement("div");
        el.className = "replay-marker";
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", "Where you were during the replay");
        marker.current = new maplibregl.Marker({ element: el }).setLngLat(at).addTo(map);
      } else marker.current.setLngLat(at);
      map.easeTo({ center: at, duration: 250 });
    },
    [map],
  );
}
