import { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectivityState: "online",
  initializeMonitoring: vi.fn(() => () => undefined),
  syncCurrentUser: vi.fn().mockResolvedValue(undefined),
  toast: {
    dismiss: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/services/sync/engine", () => ({
  readingCoreSync: { syncCurrentUser: mocks.syncCurrentUser },
}));
vi.mock("@/services/connectivity", () => ({
  CONNECTIVITY_STATE_EVENT: "brack:connectivity-state",
  getConnectivityState: () => mocks.connectivityState,
  initializeConnectivityMonitoring: mocks.initializeMonitoring,
}));

import { useNetworkStatus } from "./useNetworkStatus";

const NetworkConsumer = () => {
  const isOnline = useNetworkStatus();
  return <span>{isOnline ? "online" : "offline"}</span>;
};

const emitConnectivityState = (state: string) => {
  mocks.connectivityState = state;
  window.dispatchEvent(
    new CustomEvent("brack:connectivity-state", { detail: state })
  );
};

describe("useNetworkStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.connectivityState = "online";
    mocks.initializeMonitoring.mockClear();
    mocks.syncCurrentUser.mockClear();
    mocks.toast.dismiss.mockClear();
    mocks.toast.info.mockClear();
    mocks.toast.success.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("shows one deduplicated toast with multiple consumers under Strict Mode", () => {
    const view = render(
      <StrictMode>
        <NetworkConsumer />
        <NetworkConsumer />
      </StrictMode>
    );

    act(() => emitConnectivityState("degraded"));
    act(() => emitConnectivityState("degraded"));

    expect(mocks.toast.info).toHaveBeenCalledTimes(1);
    expect(mocks.toast.info).toHaveBeenCalledWith(
      "Connection is limited. Reading changes are being saved locally.",
      { id: "brack-connectivity-state" }
    );

    act(() => emitConnectivityState("online"));
    expect(mocks.toast.success).toHaveBeenCalledTimes(1);
    expect(mocks.toast.success).toHaveBeenCalledWith("Back online", {
      id: "brack-connectivity-state",
    });

    act(() => vi.advanceTimersByTime(500));
    expect(mocks.syncCurrentUser).toHaveBeenCalledTimes(1);

    act(() => emitConnectivityState("degraded"));
    expect(mocks.toast.info).toHaveBeenCalledTimes(2);

    view.unmount();
    act(() => emitConnectivityState("offline"));
    expect(mocks.toast.info).toHaveBeenCalledTimes(2);
  });
});
