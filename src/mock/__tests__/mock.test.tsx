// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MockChip } from "../MockChip";
import { justHeld, mockHoldDecision, useMock } from "../store";
import { useTools } from "../../tools/store";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => {
  document.body.innerHTML = "";
  useMock.setState({ pos: null });
  vi.restoreAllMocks();
});

describe("mock hold rule", () => {
  it("drops after a still half-second hold; moving first is a pan", () => {
    expect(mockHoldDecision({ heldMs: 100, movedPx: 0 })).toBe("wait");
    expect(mockHoldDecision({ heldMs: 500, movedPx: 3 })).toBe("drop");
    expect(mockHoldDecision({ heldMs: 300, movedPx: 20 })).toBe("cancel");
  });
});

describe("mock position", () => {
  it("set drops the spot and swallows the tap that follows the hold; clear removes it", () => {
    useMock.getState().drop([-85.3, 37.6]);
    expect(useMock.getState().pos).toEqual([-85.3, 37.6]);
    expect(justHeld()).toBe(true);
    useMock.getState().clear();
    expect(useMock.getState().pos).toBeNull();
  });
});

describe("mock chip", () => {
  async function mount() {
    const host = document.createElement("div");
    document.body.append(host);
    await act(async () => createRoot(host).render(createElement(MockChip)));
    return host;
  }
  it("shows nothing until a spot is held", async () => {
    const host = await mount();
    expect(host.querySelector('[data-testid="mock-chip"]')).toBeNull();
  });
  it("Clear puts the real location back", async () => {
    useMock.setState({ pos: [-85.3, 37.6] });
    const host = await mount();
    expect(host.querySelector('[data-testid="mock-chip"]')!.textContent).toContain("Pretending you're here");
    await act(async () => (host.querySelector('[data-testid="mock-clear"]') as HTMLButtonElement).click());
    expect(useMock.getState().pos).toBeNull();
  });
  it("Save as mark adds a waypoint at the held spot", async () => {
    const add = vi.spyOn(useTools.getState(), "addWaypoint").mockResolvedValue({} as never);
    useTools.setState({ addWaypoint: add } as never);
    useMock.setState({ pos: [-85.3, 37.6] });
    const host = await mount();
    await act(async () => (host.querySelector('[data-testid="mock-save"]') as HTMLButtonElement).click());
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ position: [-85.3, 37.6] }));
  });
});
