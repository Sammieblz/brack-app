import { useEffect } from "react";
import { MemoryRouter, Route, Routes, useNavigate, type NavigateFunction } from "react-router-dom";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShellUtilitiesProvider, ShellUtilitiesSlot } from "./ShellUtilities";

const state = vi.hoisted(() => ({
  finish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), received: vi.fn(),
}));
vi.mock("@/contexts/TimerContext", () => ({ useTimer: () => ({
  time: 600, isRunning: true, isVisible: true, bookTitle: "A book in progress",
  pauseTimer: vi.fn(), resumeTimer: vi.fn(), finishTimer: state.finish, cancelTimer: vi.fn(),
}) }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
vi.mock("@/components/ReadingSyncIndicator", () => ({ ReadingSyncIndicator: () => {
  useEffect(() => {
    state.subscribe();
    window.addEventListener("test-reading-sync", state.received);
    return () => {
      state.unsubscribe();
      window.removeEventListener("test-reading-sync", state.received);
    };
  }, []);
  return <p>Sync subscription active</p>;
} }));

let navigate: NavigateFunction;
function FirstScreen() { return <section aria-label="First shell"><ShellUtilitiesSlot /></section>; }
function SecondScreen() { return <main aria-label="Second shell"><ShellUtilitiesSlot /></main>; }
function TestRoutes() {
  navigate = useNavigate();
  return <Routes>
    <Route path="/first" element={<FirstScreen />} />
    <Route path="/second" element={<SecondScreen />} />
    <Route path="/without-shell" element={<p>A route without shell chrome</p>} />
  </Routes>;
}
const renderShells = () => render(<MemoryRouter initialEntries={["/first"]}>
  <ShellUtilitiesProvider><TestRoutes /></ShellUtilitiesProvider>
</MemoryRouter>);

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("App-owned shell utilities", () => {
  it("moves the same host and timer controls between route shells without restarting sync subscriptions", () => {
    const view = renderShells();
    const host = document.querySelector("[data-shell-utilities]");
    const details = screen.getByRole("button", { name: "Open timer details" });
    expect(state.subscribe).toHaveBeenCalledTimes(1);
    act(() => navigate("/second"));
    expect(document.querySelector("[data-shell-utilities]")).toBe(host);
    expect(screen.getByRole("button", { name: "Open timer details" })).toBe(details);
    expect(host?.closest("main")).toHaveAccessibleName("Second shell");
    expect(state.subscribe).toHaveBeenCalledTimes(1);
    expect(state.unsubscribe).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new Event("test-reading-sync")));
    expect(state.received).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(state.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("retains the real timer dialog and its pending submission through route replacement", async () => {
    let finish: () => void = () => undefined;
    state.finish.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    renderShells();
    fireEvent.click(screen.getByRole("button", { name: "Open timer details" }));
    const dialog = screen.getByRole("dialog", { name: "Reading session" });
    fireEvent.click(screen.getByRole("button", { name: "Finish session" }));
    expect(dialog).toHaveAttribute("aria-busy", "true");
    act(() => navigate("/second"));
    expect(screen.getByRole("dialog", { name: "Reading session" })).toBe(dialog);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(state.finish).toHaveBeenCalledTimes(1);
    expect(state.subscribe).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
    // The controller decides whether a resolved save actually cleared the timer.
    expect(screen.getByRole("dialog", { name: "Reading session" })).toBe(dialog);
    expect(screen.getByRole("button", { name: "Finish session" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Open timer details" })).toHaveFocus());
  });

  it("retains controllers while no route has a slot and reattaches their existing host", () => {
    renderShells();
    const host = document.querySelector("[data-shell-utilities]");
    act(() => navigate("/without-shell"));
    expect(host?.isConnected).toBe(false);
    expect(state.unsubscribe).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new Event("test-reading-sync")));
    expect(state.received).toHaveBeenCalledTimes(1);
    act(() => navigate("/second"));
    expect(document.querySelector("[data-shell-utilities]")).toBe(host);
    expect(state.subscribe).toHaveBeenCalledTimes(1);
  });

  it("renders no duplicate utility controllers outside the app provider", () => {
    const view = render(<ShellUtilitiesSlot />);
    expect(view.container).toBeEmptyDOMElement();
    expect(state.subscribe).not.toHaveBeenCalled();
  });
});
