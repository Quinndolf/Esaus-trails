// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { SpotWhyCard, useSpotWhy } from "../SpotWhyCard";
import { Tutorial } from "../Tutorial";
import { useEsau } from "../../esau/ui/store";
import { useHour } from "../../hour/store";
import type { Analysis } from "../../esau/analyze";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
async function mount(el: any) {
  const host = document.createElement("div");
  document.body.append(host);
  await act(async () => createRoot(host).render(el));
  return host;
}
afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  useSpotWhy.setState({ rank: null });
  useEsau.setState({ analysis: null });
  useHour.setState({ conditions: null });
  vi.restoreAllMocks();
});

const analysis = (ranks: number[]): Analysis => ({
  spots: ranks.map((rank) => ({
    rank,
    lngLat: [-85.7 + rank * 0.001, 36.75],
    watchBearingDeg: 0,
    score: 1 / rank,
    yardsToTrail: 30,
    reason: `Reason for spot ${rank}.`,
  })),
  unsure: false,
  advisories: [],
  legal: { status: "legal" } as any,
});

const reading = {
  inGrid: true,
  elevationFt: 800,
  slopeDeg: 5,
  facing: null,
  terrainWord: "gentle slope",
  thermal: { state: "Rising", strength: 0.5, flowBearing: null, line: "" },
  wind: { fromDeg: 0, mph: 5, sheltered: false, eddy: false, line: "Wind N 5 mph." },
  scent: { towardDeg: 180, mph: 2, driver: "wind", reachYards: 100, plume: null },
  summary: "",
  brief: "",
};

describe("Why this spot card", () => {
  it("stays hidden until a numbered spot is tapped", async () => {
    useEsau.setState({ analysis: analysis([1, 2, 3]) });
    const host = await mount(createElement(SpotWhyCard));
    expect(host.querySelector('[data-testid="spot-why"]')).toBeNull();
  });

  it("shows Esau's reasoning for the tapped spot at the slider's hour", async () => {
    const read = vi.fn(() => reading);
    useHour.setState({ conditions: { read } as any });
    useEsau.setState({ analysis: analysis([1, 2, 3]) });
    useSpotWhy.setState({ rank: 2 });
    const host = await mount(createElement(SpotWhyCard));
    const card = host.querySelector('[data-testid="spot-why"]')!;
    expect(card.textContent).toContain("Why spot 2");
    expect(card.textContent).toContain("Reason for spot 2.");
    expect(card.textContent).toContain("Wind N 5 mph.");
    expect(card.textContent).toContain("rising uphill");
    expect(read).toHaveBeenCalledWith(useEsau.getState().analysis!.spots[1]!.lngLat, useHour.getState().date);
  });

  it("closes when a new analysis no longer has that spot", async () => {
    useEsau.setState({ analysis: analysis([1, 2, 3]) });
    useSpotWhy.setState({ rank: 3 });
    const host = await mount(createElement(SpotWhyCard));
    expect(host.querySelector('[data-testid="spot-why"]')).toBeTruthy();
    await act(async () => useEsau.setState({ analysis: analysis([1]) }));
    expect(host.querySelector('[data-testid="spot-why"]')).toBeNull();
  });

  it("'Sit here' sends Esau to that spot and closes the card", async () => {
    const tapSpot = vi.fn(async () => {});
    useEsau.setState({ analysis: analysis([1, 2]), tapSpot });
    useSpotWhy.setState({ rank: 1 });
    const host = await mount(createElement(SpotWhyCard));
    await act(async () => (host.querySelector('[data-testid="spot-why-sit"]') as HTMLButtonElement).click());
    expect(tapSpot).toHaveBeenCalledWith({ lat: 36.75, lng: -85.7 + 0.001 });
    expect(useSpotWhy.getState().rank).toBeNull();
  });

  it("closes when the hunter taps somewhere else on the map", async () => {
    useEsau.setState({ analysis: analysis([1]), spot: null });
    useSpotWhy.setState({ rank: 1 });
    const host = await mount(createElement(SpotWhyCard));
    await act(async () => useEsau.setState({ spot: { lat: 36.7, lng: -85.6 } }));
    expect(host.querySelector('[data-testid="spot-why"]')).toBeNull();
  });

  it("Close hides it", async () => {
    useEsau.setState({ analysis: analysis([1]) });
    useSpotWhy.setState({ rank: 1 });
    const host = await mount(createElement(SpotWhyCard));
    await act(async () => (host.querySelector('[data-testid="spot-why-close"]') as HTMLButtonElement).click());
    expect(host.querySelector('[data-testid="spot-why"]')).toBeNull();
  });
});

describe("tutorial", () => {
  it("teaches that the numbered spots can be tapped for Esau's reasons", async () => {
    const host = await mount(createElement(Tutorial));
    let found = false;
    for (let i = 0; i < 10 && !found; i++) {
      found = /tap a number/i.test(host.textContent ?? "");
      const next = [...host.querySelectorAll("button")].find((b) => b.textContent === "Next");
      if (!next) break;
      await act(async () => next.click());
    }
    expect(found).toBe(true);
  });
});
