// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { useEsau } from "../../esau/ui/store";
import { hollowGrid } from "../../esau/fixtures/hollow";
import { useWindLog } from "../useWindLog";
import { samplesBetween } from "../windLog";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
function Probe({ on }: { on: boolean }) {
  useWindLog(on);
  return null;
}
afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
  useEsau.setState({ grid: null });
});

describe("useWindLog", () => {
  it("logs now and every 15 minutes while recording, and nothing otherwise", async () => {
    vi.useFakeTimers();
    useEsau.setState({ grid: hollowGrid() });
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(createElement(Probe, { on: false })));
    expect(samplesBetween(0, Infinity)).toHaveLength(0);
    await act(async () => root.render(createElement(Probe, { on: true })));
    expect(samplesBetween(0, Infinity)).toHaveLength(1);
    await act(async () => void vi.advanceTimersByTime(31 * 60e3));
    expect(samplesBetween(0, Infinity).length).toBe(3);
    await act(async () => root.render(createElement(Probe, { on: false })));
    await act(async () => void vi.advanceTimersByTime(60 * 60e3));
    expect(samplesBetween(0, Infinity).length).toBe(3);
  });
  it("does nothing when Esau has no weather yet", async () => {
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(createElement(Probe, { on: true })));
    expect(samplesBetween(0, Infinity)).toHaveLength(0);
  });
});
