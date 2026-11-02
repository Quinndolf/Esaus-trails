// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { HarvestSheet, telHref } from "../HarvestSheet";
import { ExitPrompt } from "../ExitPrompt";
import { useEsau } from "../../esau/ui/store";
import { harvestSteps } from "../../rules/kentucky";

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
  useEsau.setState({ species: null });
  vi.restoreAllMocks();
});

describe("telHref", () => {
  it("turns the first phone number in a line into a tel: link", () => {
    expect(telHref("Telecheck 1-800-245-4263 (1-800-CHK-GAME), 24 hours in season")).toBe("tel:+18002454263");
    expect(telHref("KDFWR 1-800-858-1549 (8 a.m. to 4:30 p.m.)")).toBe("tel:+18008581549");
    expect(telHref("no number here")).toBeNull();
  });
});

describe("Got one: harvest steps", () => {
  it("lists every Kentucky deer step from the rules table, with phones, source and the date it was checked", async () => {
    useEsau.setState({ species: "whitetail" });
    const host = await mount(createElement(HarvestSheet, { open: true, onClose: () => {} }));
    const h = harvestSteps("whitetail")!;
    for (const s of h.steps) expect(host.textContent).toContain(s);
    expect(host.querySelectorAll('a[href^="tel:"]').length).toBe(h.phones.length);
    expect((host.querySelector('a[href^="https://"]') as HTMLAnchorElement).href).toContain("fw.ky.gov");
    expect(host.textContent).toContain(h.verified);
    expect(host.textContent).toMatch(/KDFWR/);
  });
  it("does not invent steps for animals the table doesn't cover", async () => {
    useEsau.setState({ species: "squirrel" });
    const host = await mount(createElement(HarvestSheet, { open: true, onClose: () => {} }));
    expect(host.textContent).toMatch(/don't have/i);
    expect(host.textContent).toMatch(/KDFWR/);
    expect(host.textContent).toContain("1-800-858-1549");
    expect(host.querySelector("ol")).toBeNull();
  });
  it("is reachable from the exit prompt after saying yes", async () => {
    const onHarvest = vi.fn();
    const host = await mount(createElement(ExitPrompt, { open: true, onClose: () => {}, onHarvest }));
    await act(async () => void (host.querySelector('[data-testid="snag-yes"]') as HTMLElement).click());
    await act(async () => void (host.querySelector('[data-testid="snag-harvest"]') as HTMLElement).click());
    expect(onHarvest).toHaveBeenCalledOnce();
  });
  it("saves the yes answer and what they typed before opening the steps", async () => {
    useEsau.setState({ species: "whitetail" });
    const onHarvest = vi.fn();
    const host = await mount(createElement(ExitPrompt, { open: true, onClose: () => {}, onHarvest }));
    await act(async () => void (host.querySelector('[data-testid="snag-yes"]') as HTMLElement).click());
    await act(async () => {
      const input = host.querySelector('[data-testid="snag-what"]') as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "8 pt");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => void (host.querySelector('[data-testid="snag-harvest"]') as HTMLElement).click());
    expect(JSON.parse(localStorage.getItem("esau-snags")!)).toMatchObject([{ yes: true, what: "8 pt" }]);
    expect(JSON.parse(localStorage.getItem("esau-journal")!)[0]).toMatchObject({ snagged: "yes", what: "8 pt" });
    expect(onHarvest).toHaveBeenCalledOnce();
  });
  it("gives mule deer the same steps and every phone line a tel link", () => {
    expect(harvestSteps("mule_deer")).toEqual(harvestSteps("whitetail"));
    for (const p of harvestSteps("whitetail")!.phones) expect(telHref(p)).not.toBeNull();
  });
  it("opens the KDFWR link safely", async () => {
    useEsau.setState({ species: "whitetail" });
    const host = await mount(createElement(HarvestSheet, { open: true, onClose: () => {} }));
    expect(host.querySelector('a[href^="https://"]')!.getAttribute("rel")).toContain("noreferrer");
  });
  it("hides that button when no handler is given", async () => {
    const host = await mount(createElement(ExitPrompt, { open: true, onClose: () => {} }));
    await act(async () => void (host.querySelector('[data-testid="snag-yes"]') as HTMLElement).click());
    expect(host.querySelector('[data-testid="snag-harvest"]')).toBeNull();
  });
});
