# src/tools

The Tools menu (the orange Swiss-army button): mark my location, waypoints, draw, measure, tracker.

- `store.ts`: one zustand store for waypoints, shapes, tracks, the active tap mode and the live recording. Data persists in IndexedDB (`db.ts`, database `esau-tools`). Waypoint photos go in the shared photo store from `src/photos`.
- `useToolLayers.ts`: draws everything on the map (GeoJSON layers under the GPS dot, waypoints as DOM markers) and sends map taps to the active tool.
- `isToolCapturingTaps()`: tap-to-read should skip taps while this is true.
- `components/`: the floating tool bar (measure/draw), tracker chip, waypoint editor and saved list.
