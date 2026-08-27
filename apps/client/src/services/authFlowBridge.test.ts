import { afterEach, describe, expect, it, vi } from "vitest";
import {
  publishAuthFlowCompletion,
  subscribeToAuthFlowCompletion,
} from "./authFlowBridge";

const originalOpenerDescriptor = Object.getOwnPropertyDescriptor(window, "opener");

const setWindowOpener = (value: unknown) => {
  Object.defineProperty(window, "opener", {
    configurable: true,
    value,
  });
};

describe("auth flow completion bridge", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalOpenerDescriptor) {
      Object.defineProperty(window, "opener", originalOpenerDescriptor);
    } else {
      delete (window as Window & { opener?: unknown }).opener;
    }
  });

  it("signals a live same-origin requesting window", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const postMessage = vi.fn();
    setWindowOpener({ closed: false, postMessage });

    expect(publishAuthFlowCompletion()).toBe(true);
    expect(postMessage).toHaveBeenCalledWith(
      { type: "brack:auth-flow-completed" },
      window.location.origin,
    );
  });

  it("publishes through BroadcastChannel when there is no opener", () => {
    const postMessage = vi.fn();
    const close = vi.fn();
    const channelNames: string[] = [];

    class FakeBroadcastChannel {
      constructor(name: string) {
        channelNames.push(name);
      }

      postMessage = postMessage;
      close = close;
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
    }

    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    setWindowOpener(null);

    expect(publishAuthFlowCompletion()).toBe(false);
    expect(channelNames).toEqual(["brack:auth-flow-completed:v1"]);
    expect(postMessage).toHaveBeenCalledWith({
      type: "brack:auth-flow-completed",
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("does not turn an established Auth session into a callback error when channel delivery fails", () => {
    const close = vi.fn();
    class FailingBroadcastChannel {
      postMessage() {
        throw new Error("channel unavailable");
      }
      close = close;
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
    }
    vi.stubGlobal("BroadcastChannel", FailingBroadcastChannel);
    setWindowOpener(null);

    expect(() => publishAuthFlowCompletion()).not.toThrow();
    expect(close).toHaveBeenCalledOnce();
  });

  it("accepts only same-origin completion messages and removes its listener", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const listener = vi.fn();
    const unsubscribe = subscribeToAuthFlowCompletion(listener);

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://attacker.example",
        data: { type: "brack:auth-flow-completed" },
      }),
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        data: { type: "not-an-auth-message" },
      }),
    );
    expect(listener).not.toHaveBeenCalled();

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        data: { type: "brack:auth-flow-completed" },
      }),
    );
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        data: { type: "brack:auth-flow-completed" },
      }),
    );
    expect(listener).toHaveBeenCalledOnce();
  });
});
