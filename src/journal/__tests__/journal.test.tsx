// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { destination } from "../../map/geo";
import { useTools } from "../../tools/store";
import type { Track } from "../../tools/types";
import { ExitPrompt } from "../../home/ExitPrompt";
import { useEsau } from "../../esau/ui/store";
import { useWeapon } from "../../home/weapon";
import { JournalSheet } from "../JournalSheet";
import { useJournal } from "../store";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const START: [number, number] = [-85.7, 36.75];
const track: Track = {
  id: "t1",
  name: "Morning",
  startedAt: 0,
  endedAt: 600_000,
  distance: 0,
  points: Array.from({ length: 11 }, (_, i) => ({ lngLat: destination(START, 90, i * 10), time: i * 60_000, altitude: null })),
};
async function mount(el: any) {
  const host = document.createElement("div");
  document.body.append(host);
  await act(async () => createRoot(host).render(el));
  return host;
}
const click = (h: HTMLElement, s: string) => act(async () => void (h.querySelector(s) as HTMLElement).click());

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  useJournal.setState({ entries: [] });
  useTools.setState({ tracks: [], waypoints: [] });
  useEsau.setState({ species: null });
  vi.restoreAllMocks();
});

describe("hunt journal", () => {
  it("saves 'yes, a doe' from the exit prompt against the latest track, and lists it", async () => {
    useTools.setState({ tracks: [track] });
    useEsau.setState({ species: "whitetail" });
    useEsau.setState({ weapon: "bow" });
    const host = await mount(createElement(ExitPrompt, { open: true, onClose: () => {} }));
    await click(host, '[data-testid="snag-yes"]');
    await act(async () => {
      const input = host.querySelector('[data-testid="snag-what"]') as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "a doe");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click(host, '[data-testid="snag-save"]');
    const [e] = useJournal.getState().entries;
    expect(e).toMatchObject({ trackId: "t1", species: "whitetail", weapon: "bow", snagged: "yes", what: "a doe" });
    expect(JSON.parse(localStorage.getItem("esau-journal")!)).toHaveLength(1);
  });

  it("shows distance, duration, sits and debrief lines for a track, and never calls fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    useTools.setState({ tracks: [track] });
    useJournal.setState({ entries: [{ id: "j1", trackId: "t1", date: "2026-11-01", species: "whitetail", weapon: "bow", snagged: "no", windFromDeg: null, beds: [], trails: [] }] });
    const host = await mount(createElement(JournalSheet, { open: true, onClose: () => {} }));
    expect(host.textContent).toContain("yd");
    expect(host.textContent).toContain("Clean walk");
    expect(host.textContent).toContain("Nothing this time");
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("copes with an entry whose track was deleted, and with an empty journal", async () => {
    useJournal.setState({ entries: [{ id: "j2", trackId: "gone", date: "2026-11-01", species: "squirrel", weapon: "pellet", snagged: null, windFromDeg: null, beds: [], trails: [] }] });
    let host = await mount(createElement(JournalSheet, { open: true, onClose: () => {} }));
    expect(host.textContent).toContain("no route");
    document.body.innerHTML = "";
    useJournal.setState({ entries: [] });
    host = await mount(createElement(JournalSheet, { open: true, onClose: () => {} }));
    expect(host.textContent).toContain("No hunts yet");
  });

  it("survives corrupt saved data", () => {
    localStorage.setItem("esau-journal", "{not json");
    useJournal.getState().load();
    expect(useJournal.getState().entries).toEqual([]);
  });
});
