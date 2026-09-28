import { useContext } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { BrowserRouter, MemoryRouter, useLocation, useNavigate, type Location, type NavigateFunction } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_HISTORY_STORAGE_KEY } from "@/lib/appHistory";
import { AppNavigationContext, type AppNavigation } from "./appNavigation";

const native = vi.hoisted(() => ({
  subscribe: vi.fn(),
  stop: vi.fn(),
  minimize: vi.fn(),
  overlay: vi.fn(),
}));
vi.mock("@/services/nativeBack", () => ({ subscribeNativeBack: native.subscribe, minimizeNativeApp: native.minimize }));
vi.mock("@/lib/backLayers", () => ({ requestOverlayBack: native.overlay }));
import { AppNavigationProvider } from "./AppNavigationProvider";

type Scope = string | null | undefined;
const flush = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };

function mount(options: { scope?: Scope; memory?: boolean } = {}) {
  const initialScope = Object.prototype.hasOwnProperty.call(options, "scope") ? options.scope : "account-a";
  const memory = options.memory ?? false;
  let context!: AppNavigation;
  let navigate!: NavigateFunction;
  let location!: Location;
  function Probe() {
    context = useContext(AppNavigationContext)!;
    navigate = useNavigate();
    location = useLocation();
    return <output>{location.pathname}</output>;
  }
  const tree = (scope: Scope) => {
    const content = <AppNavigationProvider accountScope={scope}><Probe /></AppNavigationProvider>;
    return memory
      ? <MemoryRouter initialEntries={["/book/direct"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{content}</MemoryRouter>
      : <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{content}</BrowserRouter>;
  };
  const view = render(tree(initialScope));
  return {
    get context() { return context; },
    get location() { return location; },
    navigate: (path: string) => act(() => { navigate(path); }),
    setScope: (scope: Scope) => view.rerender(tree(scope)),
    unmount: view.unmount,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  native.subscribe.mockReturnValue(native.stop);
  native.overlay.mockReturnValue(false);
  window.sessionStorage.removeItem(APP_HISTORY_STORAGE_KEY);
  window.history.replaceState({ idx: 0, key: "default" }, "", "/my-books");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("application Back coordinator", () => {
  it("uses a replacement recovery route for a direct entry even with a positive browser index", () => {
    window.history.replaceState({ idx: 42, key: "external-entry" }, "", "/book/direct");
    const app = mount();
    expect(app.context.canGoBack).toBe(false);
    act(() => app.context.requestBack());
    expect(app.location.pathname).toBe("/my-books");
    expect(window.history.state.idx).toBe(42);
    expect(app.context.canGoBack).toBe(false);
  });

  it("observes BrowserRouter pushes and moves back only one entry for rapid requests", async () => {
    const app = mount();
    app.navigate("/book/one");
    app.navigate("/edit-book/one");
    expect(app.context.canGoBack).toBe(true);
    act(() => { app.context.requestBack(); app.context.requestBack(); });
    await waitFor(() => expect(app.location.pathname).toBe("/book/one"));
    expect(window.history.state.idx).toBe(1);
  });

  it("restores a matched BrowserRouter entry after the provider remounts", async () => {
    const first = mount();
    first.navigate("/book/one");
    first.unmount();
    const second = mount();
    expect(second.context.canGoBack).toBe(true);
    act(() => second.context.requestBack());
    await waitFor(() => expect(second.location.pathname).toBe("/my-books"));
  });

  it("rechecks the actual history identity at activation", () => {
    const app = mount();
    app.navigate("/book/one");
    expect(app.context.canGoBack).toBe(true);
    window.history.replaceState({ idx: 1, key: "unobserved-replacement" }, "");
    act(() => app.context.requestBack({ fallbackPath: "/lists" }));
    expect(app.location.pathname).toBe("/lists");
    expect(window.history.state.idx).toBe(1);
  });

  it("does not treat MemoryRouter entries as browser ancestry", () => {
    window.history.replaceState({ idx: 12, key: "browser-only" }, "");
    const app = mount({ memory: true });
    app.navigate("/book/next");
    expect(app.context.canGoBack).toBe(false);
    act(() => app.context.requestBack({ fallbackPath: "/lists" }));
    expect(app.location.pathname).toBe("/lists");
  });

  it("defers history observation while authentication resolves without deleting reload evidence", () => {
    const first = mount();
    first.navigate("/book/one");
    const saved = window.sessionStorage.getItem(APP_HISTORY_STORAGE_KEY);
    first.unmount();
    const second = mount({ scope: undefined });
    expect(second.context.canGoBack).toBe(false);
    act(() => second.context.requestBack());
    expect(second.location.pathname).toBe("/book/one");
    expect(window.sessionStorage.getItem(APP_HISTORY_STORAGE_KEY)).toBe(saved);
    second.setScope("account-a");
    expect(second.context.canGoBack).toBe(true);
  });

  it("clears route ancestry across account changes and auth boundaries", () => {
    const app = mount();
    app.navigate("/book/one");
    app.setScope("account-b");
    expect(app.context.canGoBack).toBe(false);
    app.setScope("account-a");
    expect(app.context.canGoBack).toBe(false);
    app.navigate("/book/two");
    expect(app.context.canGoBack).toBe(true);
    app.navigate("/auth/callback?code=fixture-code");
    expect(window.sessionStorage.getItem(APP_HISTORY_STORAGE_KEY)).toBeNull();
    app.navigate("/dashboard");
    expect(app.context.canGoBack).toBe(false);
  });

  it("clears an auth callback boundary even while account scope is still loading", () => {
    const first = mount();
    first.navigate("/book/one");
    expect(window.sessionStorage.getItem(APP_HISTORY_STORAGE_KEY)).not.toBeNull();
    first.unmount();
    window.history.replaceState({ key: "callback-entry", idx: 1 }, "", "/auth/callback?code=fixture-code");
    const callback = mount({ scope: undefined });
    expect(callback.context.canGoBack).toBe(false);
    expect(window.sessionStorage.getItem(APP_HISTORY_STORAGE_KEY)).toBeNull();
    callback.navigate("/dashboard");
    callback.setScope("account-a");
    expect(callback.context.canGoBack).toBe(false);
  });

  it("lets an overlay consume Back before route callbacks, guards, or minimization", () => {
    const app = mount();
    const callback = vi.fn();
    const guard = vi.fn().mockReturnValue(true);
    app.context.registerGuard(guard, 1, app.context.routeKey);
    native.overlay.mockReturnValue(true);
    act(() => app.context.requestBack({ onBack: callback }, "native"));
    expect(callback).not.toHaveBeenCalled();
    expect(guard).not.toHaveBeenCalled();
    expect(native.minimize).not.toHaveBeenCalled();
    expect(app.location.pathname).toBe("/my-books");
  });

  it("retains explicit callback precedence and explicit route destinations", () => {
    const app = mount();
    app.navigate("/book/one");
    const callback = vi.fn();
    act(() => app.context.requestBack({ onBack: callback, to: "/lists" }));
    expect(callback).toHaveBeenCalledTimes(1);
    expect(app.location.pathname).toBe("/book/one");
    act(() => app.context.requestBack({ to: "/lists" }));
    expect(app.location.pathname).toBe("/lists");
    expect(window.history.state.idx).toBe(2);
  });

  it("runs only the highest-priority current guard and retains the route on refusal", async () => {
    const app = mount();
    app.navigate("/edit-book/one");
    const lower = vi.fn().mockReturnValue(true);
    const higher = vi.fn().mockReturnValue(false);
    app.context.registerGuard(lower, 0, app.context.routeKey);
    const unregister = app.context.registerGuard(higher, 10, app.context.routeKey);
    await act(async () => { app.context.requestBack(); await flush(); });
    expect(higher).toHaveBeenCalledTimes(1);
    expect(lower).not.toHaveBeenCalled();
    expect(app.location.pathname).toBe("/edit-book/one");
    unregister();
    await act(async () => { app.context.requestBack({ to: "/lists" }); await flush(); });
    expect(lower).toHaveBeenCalledTimes(1);
    expect(app.location.pathname).toBe("/lists");
  });

  it("serializes a pending confirmation and ignores it after an account switch", async () => {
    const app = mount();
    app.navigate("/edit-book/one");
    let resolve!: (allowed: boolean) => void;
    const guard = vi.fn(() => new Promise<boolean>(done => { resolve = done; }));
    app.context.registerGuard(guard, 0, app.context.routeKey);
    const callback = vi.fn();
    await act(async () => {
      app.context.requestBack({ onBack: callback });
      app.context.requestBack({ onBack: callback });
      await flush();
    });
    expect(guard).toHaveBeenCalledTimes(1);
    app.setScope("account-b");
    await act(async () => { resolve(true); await flush(); });
    expect(callback).not.toHaveBeenCalled();
    expect(app.location.pathname).toBe("/edit-book/one");
  });

  it("distinguishes anonymous identity from loading during pending confirmation", async () => {
    const app = mount({ scope: null });
    let resolve!: (allowed: boolean) => void;
    app.context.registerGuard(() => new Promise<boolean>(done => { resolve = done; }), 0, app.context.routeKey);
    const callback = vi.fn();
    await act(async () => { app.context.requestBack({ onBack: callback }); await flush(); });
    app.setScope(undefined);
    await act(async () => { resolve(true); await flush(); });
    expect(callback).not.toHaveBeenCalled();
  });

  it("allows Back on a new route while an old confirmation is pending and keeps newer ownership intact", async () => {
    const app = mount();
    let resolveOld!: (allowed: boolean) => void;
    app.context.registerGuard(() => new Promise<boolean>(done => { resolveOld = done; }), 0, app.context.routeKey);
    const oldCallback = vi.fn();
    await act(async () => { app.context.requestBack({ onBack: oldCallback }); await flush(); });
    app.navigate("/edit-book/one");
    let resolveNew!: (allowed: boolean) => void;
    const newGuard = vi.fn(() => new Promise<boolean>(done => { resolveNew = done; }));
    app.context.registerGuard(newGuard, 0, app.context.routeKey);
    const newCallback = vi.fn();
    await act(async () => { app.context.requestBack({ onBack: newCallback }); await flush(); });
    expect(newGuard).toHaveBeenCalledTimes(1);
    await act(async () => { resolveOld(true); await flush(); });
    expect(oldCallback).not.toHaveBeenCalled();
    await act(async () => { app.context.requestBack({ onBack: newCallback }); await flush(); });
    expect(newGuard).toHaveBeenCalledTimes(1);
    await act(async () => { resolveNew(true); await flush(); });
    expect(newCallback).toHaveBeenCalledTimes(1);
  });

  it("does not begin a stale confirmation when the route changes before its microtask", async () => {
    const app = mount();
    const guard = vi.fn().mockReturnValue(true);
    app.context.registerGuard(guard, 0, app.context.routeKey);
    act(() => app.context.requestBack());
    app.navigate("/book/new");
    await act(flush);
    expect(guard).not.toHaveBeenCalled();
    expect(app.location.pathname).toBe("/book/new");
  });

  it("contains a failed confirmation and allows a subsequent Back attempt", async () => {
    const app = mount();
    const error = new Error("confirmation failed");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unregister = app.context.registerGuard(() => Promise.reject(error), 0, app.context.routeKey);
    await act(async () => { app.context.requestBack({ to: "/lists" }); await flush(); });
    expect(app.location.pathname).toBe("/my-books");
    expect(log).toHaveBeenCalledWith("Could not resolve app Back; current task retained", error);
    unregister();
    act(() => app.context.requestBack({ to: "/lists" }));
    expect(app.location.pathname).toBe("/lists");
  });

  it("does not dispatch an approved pending callback after provider unmount", async () => {
    const app = mount();
    let resolve!: (allowed: boolean) => void;
    app.context.registerGuard(() => new Promise<boolean>(done => { resolve = done; }), 0, app.context.routeKey);
    const callback = vi.fn();
    await act(async () => { app.context.requestBack({ onBack: callback }); await flush(); });
    app.unmount();
    await act(async () => { resolve(true); await flush(); });
    expect(callback).not.toHaveBeenCalled();
  });

  it("does not start a confirmation after provider unmounts before its microtask", async () => {
    const app = mount();
    const guard = vi.fn().mockReturnValue(true);
    app.context.registerGuard(guard, 0, app.context.routeKey);
    act(() => app.context.requestBack());
    app.unmount();
    await act(flush);
    expect(guard).not.toHaveBeenCalled();
  });

  it("keeps one native subscription across navigation and backgrounds at an app root", () => {
    const app = mount();
    expect(native.subscribe).toHaveBeenCalledTimes(1);
    const nativeBack = native.subscribe.mock.calls[0][0];
    app.navigate("/book/one");
    app.navigate("/lists");
    expect(native.subscribe).toHaveBeenCalledTimes(1);
    act(() => nativeBack());
    expect(native.minimize).toHaveBeenCalledTimes(1);
    expect(app.location.pathname).toBe("/lists");
    app.unmount();
    expect(native.stop).toHaveBeenCalledTimes(1);
  });

  it("uses a visible native Back control and ignores it when disabled or from a previous route", () => {
    const app = mount();
    const button = document.createElement("button");
    document.body.appendChild(button);
    vi.spyOn(button, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
    const callback = vi.fn();
    app.context.registerControl(button, () => ({ onBack: callback }), app.context.routeKey);
    act(() => app.context.requestBack(undefined, "native"));
    expect(callback).toHaveBeenCalledTimes(1);
    expect(native.minimize).not.toHaveBeenCalled();
    button.disabled = true;
    act(() => app.context.requestBack(undefined, "native"));
    expect(native.minimize).toHaveBeenCalledTimes(1);
    button.disabled = false;
    app.navigate("/lists");
    act(() => app.context.requestBack(undefined, "native"));
    expect(callback).toHaveBeenCalledTimes(1);
    expect(native.minimize).toHaveBeenCalledTimes(2);
    button.remove();
  });
});
