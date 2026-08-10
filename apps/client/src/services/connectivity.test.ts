import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setNavigatorOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
};

const createDeferredResponse = () => {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

describe("connectivity service", () => {
  beforeEach(() => {
    vi.resetModules();
    setNavigatorOnline(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setNavigatorOnline(true);
  });

  it("coalesces concurrent health probes and emits a degraded transition once", async () => {
    const deferred = createDeferredResponse();
    const fetchMock = vi.fn(() => deferred.promise);
    vi.stubGlobal("fetch", fetchMock);
    const connectivity = await import("./connectivity");
    const transitions: string[] = [];
    const handleState = (event: Event) => {
      transitions.push((event as CustomEvent<string>).detail);
    };
    window.addEventListener(connectivity.CONNECTIVITY_STATE_EVENT, handleState);

    const firstProbe = connectivity.probeConnectivity(true);
    const secondProbe = connectivity.probeConnectivity(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    deferred.resolve(new Response(null, { status: 503 }));

    await expect(firstProbe).resolves.toBe("degraded");
    await expect(secondProbe).resolves.toBe("degraded");
    expect(transitions).toEqual(["degraded"]);
    window.removeEventListener(connectivity.CONNECTIVITY_STATE_EVENT, handleState);
  });

  it("checks service health before an API failure downgrades global connectivity", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const connectivity = await import("./connectivity");
    const handleState = vi.fn();
    window.addEventListener(connectivity.CONNECTIVITY_STATE_EVENT, handleState);

    connectivity.markConnectivityFailure();
    await connectivity.probeConnectivity(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(connectivity.getConnectivityState()).toBe("online");
    expect(handleState).not.toHaveBeenCalled();
    window.removeEventListener(connectivity.CONNECTIVITY_STATE_EVENT, handleState);
  });

  it("shares one monitor across subscribers and removes it after the final cleanup", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const connectivity = await import("./connectivity");

    const cleanupFirst = connectivity.initializeConnectivityMonitoring();
    const cleanupSecond = connectivity.initializeConnectivityMonitoring();
    await connectivity.probeConnectivity();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    cleanupFirst();
    setNavigatorOnline(false);
    window.dispatchEvent(new Event("offline"));
    expect(connectivity.getConnectivityState()).toBe("offline");

    cleanupSecond();
    setNavigatorOnline(true);
    connectivity.markConnectivitySuccess();
    setNavigatorOnline(false);
    window.dispatchEvent(new Event("offline"));
    expect(connectivity.getConnectivityState()).toBe("online");
  });

  it("does not let a stale failed probe overwrite a newer successful request", async () => {
    const deferred = createDeferredResponse();
    vi.stubGlobal("fetch", vi.fn(() => deferred.promise));
    const connectivity = await import("./connectivity");

    const probe = connectivity.probeConnectivity(true);
    connectivity.markConnectivitySuccess();
    deferred.resolve(new Response(null, { status: 503 }));

    await expect(probe).resolves.toBe("online");
    expect(connectivity.getConnectivityState()).toBe("online");
  });

  it("treats an HTTP authentication response from the health endpoint as reachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const connectivity = await import("./connectivity");

    await expect(connectivity.probeConnectivity(true)).resolves.toBe("online");
    expect(connectivity.getConnectivityState()).toBe("online");
  });

  it("does not classify an unrelated TypeError as a connectivity failure", async () => {
    const connectivity = await import("./connectivity");

    expect(
      connectivity.isRetryableConnectivityError(
        new TypeError("Cannot read properties of undefined (reading 'id')")
      )
    ).toBe(false);
    expect(connectivity.isRetryableConnectivityError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("does not emit duplicate events when the state is unchanged", async () => {
    const connectivity = await import("./connectivity");
    const transitions: string[] = [];
    const handleState = (event: Event) => {
      transitions.push((event as CustomEvent<string>).detail);
    };
    window.addEventListener(connectivity.CONNECTIVITY_STATE_EVENT, handleState);

    connectivity.markAuthenticationRequired();
    connectivity.markAuthenticationRequired();
    connectivity.markConnectivitySuccess();
    connectivity.markConnectivitySuccess();

    expect(transitions).toEqual(["authentication_required", "online"]);
    window.removeEventListener(connectivity.CONNECTIVITY_STATE_EVENT, handleState);
  });
});
