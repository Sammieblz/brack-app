import { afterEach, describe, expect, it, vi } from "vitest";
import { hasOpenOverlay, registerBackLayer, requestOverlayBack } from "./backLayers";

const cleanups: Array<() => void> = [];
const layer = (state: string) => {
  const element = document.createElement("div");
  element.dataset.state = state;
  document.body.append(element);
  cleanups.push(registerBackLayer(element), () => element.remove());
  return element;
};

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  expect(hasOpenOverlay()).toBe(false);
});

describe("explicit Back overlay ownership", () => {
  it("does not guess ownership from dialog roles or unrelated DOM", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.dataset.state = "open";
    document.body.append(dialog);
    cleanups.push(() => dialog.remove());
    expect(requestOverlayBack()).toBe(false);
  });

  it("dispatches one cancelable Escape and consumes even when a guard rejects it", () => {
    layer("open");
    layer("open");
    const listener = vi.fn((event: KeyboardEvent) => event.preventDefault());
    document.addEventListener("keydown", listener);
    cleanups.push(() => document.removeEventListener("keydown", listener));
    expect(requestOverlayBack()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({ key: "Escape", cancelable: true, bubbles: true });
    expect(hasOpenOverlay()).toBe(true);
  });

  it("ignores closed forceMount and disconnected content", () => {
    layer("closed");
    layer("open").remove();
    expect(requestOverlayBack()).toBe(false);
  });

  it("consumes a closing animation without redispatching dismissal, then releases ownership", () => {
    const closing = layer("closed");
    const animation = { playState: "running" };
    Object.defineProperty(closing, "getAnimations", { value: () => [animation] });
    const listener = vi.fn();
    document.addEventListener("keydown", listener);
    cleanups.push(() => document.removeEventListener("keydown", listener));
    expect(requestOverlayBack()).toBe(true);
    expect(listener).not.toHaveBeenCalled();
    animation.playState = "finished";
    expect(requestOverlayBack()).toBe(false);
  });

  it("does not send another Escape through an exiting layer to an open parent", () => {
    layer("open");
    const closing = layer("closed");
    Object.defineProperty(closing, "getAnimations", { value: () => [{ playState: "running" }] });
    const listener = vi.fn();
    document.addEventListener("keydown", listener);
    cleanups.push(() => document.removeEventListener("keydown", listener));
    expect(requestOverlayBack()).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps independent registrations until both composed owners detach", () => {
    const element = layer("open");
    const removeSecond = registerBackLayer(element);
    removeSecond();
    removeSecond();
    expect(hasOpenOverlay()).toBe(true);
  });

  it("makes cleanup idempotent after a reused element has a new registration", () => {
    const element = document.createElement("div");
    element.dataset.state = "open";
    document.body.append(element);
    const first = registerBackLayer(element);
    first();
    cleanups.push(registerBackLayer(element), () => element.remove());
    first();
    expect(hasOpenOverlay()).toBe(true);
  });
});
