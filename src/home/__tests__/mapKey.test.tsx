// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement, Fragment } from "react";
import { createRoot } from "react-dom/client";
import { MapKeyButton, MapKeyCard, WhatsThisCard, useExplain } from "../MapKey";
import { Tutorial } from "../Tutorial";
import { useEsau } from "../../esau/ui/store";
import { useHour } from "../../hour/store";
import { useSpotWhy } from "../SpotWhyCard";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
async function mount(el: any) {
  const host = document.createElement("div");
  document.body.append(host);
  await act(async () => createRoot(host).render(el));
  return host;
}
const click = async (host: Element, sel: string) => act(async () => (host.querySelector(sel) as HTMLButtonElement).click());
afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  useExplain.setState({ item: null, keyOpen: false });
  useEsau.setState({ species: null, spot: null });
  useHour.setState({ showFood: true, showThermals: true });
  vi.restoreAllMocks();
});

describe("map key", () => {
  it("the ? button opens a key of every deer mark, each with a picture", async () => {
    useEsau.setState({ species: "whitetail" });
    const host = await mount(createElement(Fragment, null, createElement(MapKeyButton), createElement(MapKeyCard)));
    expect(host.querySelector('[data-testid="map-key"]')).toBeNull();
    await click(host, '[data-testid="map-key-btn"]');
    const key = host.querySelector('[data-testid="map-key"]')!;
    for (const id of ["trails", "beds", "wind", "thermal-ticks", "scent", "sit-spots"]) {
      const row = key.querySelector(`[data-testid="key-${id}"]`);
      expect(row, id).toBeTruthy();
      expect(row!.querySelector("svg")).toBeTruthy();
    }
    expect(key.textContent).toContain("Tap any line, dot or arrow");
    await click(host, '[data-testid="map-key-close"]');
    expect(host.querySelector('[data-testid="map-key"]')).toBeNull();
  });

  it("follows the Thermals toggle", async () => {
    useEsau.setState({ species: "whitetail" });
    useHour.setState({ showThermals: false });
    useExplain.setState({ keyOpen: true });
    const host = await mount(createElement(MapKeyCard));
    expect(host.querySelector('[data-testid="key-thermal-shade"]')).toBeNull();
  });

  it("asks for an animal first when none is picked", async () => {
    useExplain.setState({ keyOpen: true });
    const host = await mount(createElement(MapKeyCard));
    expect(host.textContent).toMatch(/Pick an animal/);
  });
});

describe("what's this card", () => {
  const item = { title: "Likely trail", text: "Deer will likely walk here.", lngLat: [-85.7, 36.75] as [number, number] };

  it("shows Esau's words for a tapped mark", async () => {
    useExplain.setState({ item });
    const host = await mount(createElement(WhatsThisCard));
    expect(host.querySelector('[data-testid="whats-this"]')!.textContent).toContain("Deer will likely walk here.");
  });

  it("'Sit here' reads that spot and closes", async () => {
    const tapSpot = vi.fn(async () => {});
    useEsau.setState({ tapSpot });
    useExplain.setState({ item });
    const host = await mount(createElement(WhatsThisCard));
    await click(host, '[data-testid="whats-this-sit"]');
    expect(tapSpot).toHaveBeenCalledWith({ lat: 36.75, lng: -85.7 });
    expect(useExplain.getState().item).toBeNull();
  });

  it("'Map key' swaps to the key", async () => {
    useExplain.setState({ item });
    const host = await mount(createElement(WhatsThisCard));
    await click(host, '[data-testid="whats-this-key"]');
    expect(useExplain.getState()).toMatchObject({ item: null, keyOpen: true });
  });

  it("closes when the hunter taps somewhere else for a read", async () => {
    useExplain.setState({ item });
    const host = await mount(createElement(WhatsThisCard));
    await act(async () => useEsau.setState({ spot: { lat: 1, lng: 2 } }));
    expect(host.querySelector('[data-testid="whats-this"]')).toBeNull();
  });
});

describe("one card at a time", () => {
  it("a tapped mark or the key closes the sit-spot card, and a sit spot closes them", () => {
    useSpotWhy.setState({ rank: 1 });
    useExplain.getState().show({ title: "t", text: "x", lngLat: [0, 0] });
    expect(useSpotWhy.getState().rank).toBeNull();
    useSpotWhy.getState().show(2);
    expect(useExplain.getState().item).toBeNull();
    useExplain.getState().openKey(true);
    expect(useSpotWhy.getState().rank).toBeNull();
    useSpotWhy.getState().show(1);
    expect(useExplain.getState().keyOpen).toBe(false);
  });
});

describe("tutorial", () => {
  it("has a step that teaches the trails, beds and wind arrows and points at the ? key", async () => {
    const host = await mount(createElement(Tutorial));
    let text = "";
    for (let i = 0; i < 12; i++) {
      text += host.textContent;
      const next = [...host.querySelectorAll("button")].find((b) => b.textContent === "Next");
      if (!next) break;
      await act(async () => next.click());
    }
    expect(text).toMatch(/Yellow dashed lines are likely deer trails/);
    expect(text).toMatch(/Brown dots with a yellow rim/);
    expect(text).toMatch(/White arrows with a dark outline show the wind/);
    expect(text).toMatch(/\? button/);
  });
});
