import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  auth: { user: { id: "reader-a" } as { id: string } | null, loading: false },
  compact: true,
  connected: true,
  local: vi.fn(), remote: vi.fn(), hydrate: vi.fn(), metrics: vi.fn(), activity: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/hooks/useUIEnvironment", () => ({ useUIEnvironmentValue: () => mocks.compact }));
vi.mock("@/services/api", () => ({ fetchActiveBookById: mocks.remote, getBookProgress: mocks.metrics, fetchProgressTrackingData: mocks.activity }));
vi.mock("@/services/local", () => ({ booksRepo: { get: mocks.local, upsertRemoteManyPreservingLocal: mocks.hydrate } }));
vi.mock("@/services/connectivity", () => ({ CONNECTIVITY_STATE_EVENT: "test:connection", isConnectivityAvailable: () => mocks.connected }));
vi.mock("@/components/MobileLayout", () => ({ MobileLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/MobileHeader", () => ({ MobileHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/AppBackButton", () => ({ AppBackButton: () => <button type="button">Back to book</button> }));
vi.mock("@/components/ProgressLogger", () => ({ ProgressLogger: ({ open, onSuccess, onOpenChange }: {
  open: boolean; onSuccess: () => Promise<void>; onOpenChange: (open: boolean) => void;
}) => open ? <div role="dialog" aria-label="Log progress"><label>Draft<input /></label><button type="button" onClick={() => { void onSuccess(); onOpenChange(false); }}>Confirm saved</button></div> : null }));
vi.mock("@/components/charts/ReadingVelocityChart", () => ({ ReadingVelocityChart: () => <div>Velocity chart</div> }));
vi.mock("@/components/charts/DailyPagesChart", () => ({ DailyPagesChart: () => <div>Daily chart</div> }));
vi.mock("@/components/charts/CompletionForecastChart", () => ({ CompletionForecastChart: () => <div>Forecast chart</div> }));

import ProgressTracking from "./ProgressTracking";

const book = { id: "book-1", user_id: "reader-a", title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", current_page: 42, pages: 300, deleted_at: null };
const activity = { dailyProgress: [{ date: "2026-10-01", pages_read: 20, time_spent: 25 }], velocityData: [], forecastData: [] };
const View = () => <MemoryRouter initialEntries={["/book/book-1/progress"]}><Routes><Route path="/book/:id/progress" element={<ProgressTracking />} /></Routes></MemoryRouter>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth = { user: { id: "reader-a" }, loading: false };
  mocks.connected = true;
  mocks.compact = true;
  mocks.local.mockResolvedValue(book);
  mocks.remote.mockResolvedValue(book);
  mocks.hydrate.mockResolvedValue([book]);
  mocks.metrics.mockResolvedValue(null);
  mocks.activity.mockResolvedValue(activity);
});
afterEach(cleanup);

describe("ProgressTracking owned local place and remote activity", () => {
  it("keeps cached capture available offline without starting remote reads", async () => {
    mocks.connected = false;
    render(<View />);
    fireEvent.click(await screen.findByRole("button", { name: "Log progress" }));
    expect(screen.getByRole("dialog", { name: "Log progress" })).toBeVisible();
    expect(screen.getByText(/Reconnect to load activity and insights/)).toBeVisible();
    expect(mocks.remote).not.toHaveBeenCalled();
    expect(mocks.metrics).not.toHaveBeenCalled();
    expect(mocks.activity).not.toHaveBeenCalled();
  });

  it("retains loaded activity offline and fetches it again on reconnection", async () => {
    render(<View />);
    await screen.findByRole("list", { name: "Daily reading activity" });
    const calls = mocks.activity.mock.calls.length;
    await act(async () => { mocks.connected = false; window.dispatchEvent(new Event("test:connection")); });
    expect(screen.getByRole("list", { name: "Daily reading activity" })).toBeVisible();
    expect(screen.getByText(/Showing activity already loaded/)).toBeVisible();
    expect(mocks.activity).toHaveBeenCalledTimes(calls);
    await act(async () => { mocks.connected = true; window.dispatchEvent(new Event("test:connection")); });
    expect(mocks.activity).toHaveBeenCalledTimes(calls + 1);
  });

  it("rejects another reader's cached book while offline", async () => {
    mocks.connected = false;
    mocks.local.mockResolvedValue({ ...book, user_id: "reader-b" });
    render(<View />);
    await screen.findByText(/isn't available on this device/);
    expect(screen.queryByText(book.title)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log progress" })).not.toBeInTheDocument();
    expect(mocks.remote).not.toHaveBeenCalled();
  });

  it("never revives a locally deleted book through remote fallback", async () => {
    mocks.local.mockResolvedValue({ ...book, deleted_at: "2026-10-01T12:00:00Z" });
    render(<View />);
    await screen.findByText(/This book could not be loaded/);
    expect(mocks.remote).not.toHaveBeenCalled();
    expect(mocks.hydrate).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Log progress" })).not.toBeInTheDocument();
  });

  it("uses the local value preserved during remote hydration", async () => {
    mocks.local.mockResolvedValue(null);
    mocks.hydrate.mockResolvedValue([{ ...book, current_page: 84 }]);
    render(<View />);
    await screen.findByText("Page 84", { exact: false });
    expect(mocks.hydrate).toHaveBeenCalledWith("reader-a", [book]);
    expect(screen.queryByText("Page 42", { exact: false })).not.toBeInTheDocument();
  });

  it("refreshes the confirmed local page without replacing it with remote metrics", async () => {
    render(<View />);
    fireEvent.click(await screen.findByRole("button", { name: "Log progress" }));
    mocks.local.mockResolvedValue({ ...book, current_page: 90 });
    fireEvent.click(screen.getByRole("button", { name: "Confirm saved" }));
    await screen.findByText("Page 90", { exact: false });
    expect(mocks.remote).not.toHaveBeenCalled();
  });

  it("preserves a capture draft through header resize, then clears it on reader change", async () => {
    const { rerender } = render(<View />);
    fireEvent.click(await screen.findByRole("button", { name: "Log progress" }));
    const draft = screen.getByLabelText("Draft");
    fireEvent.change(draft, { target: { value: "A page worth remembering" } });
    mocks.compact = false;
    rerender(<View />);
    expect(screen.getByLabelText("Draft")).toBe(draft);
    expect(draft).toHaveValue("A page worth remembering");
    mocks.auth = { user: { id: "reader-b" }, loading: false };
    mocks.local.mockResolvedValue({ ...book, user_id: "reader-b" });
    rerender(<View />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(await screen.findByRole("button", { name: "Log progress" }));
    expect(screen.getByLabelText("Draft")).toHaveValue("");
  });

  it("does not start a remote fallback when an obsolete local read resolves after reader change", async () => {
    let releaseLocal!: (value: null) => void;
    mocks.local.mockReturnValueOnce(new Promise<null>(resolve => { releaseLocal = resolve; }));
    const { rerender } = render(<View />);
    mocks.auth = { user: { id: "reader-b" }, loading: false };
    mocks.local.mockResolvedValue({ ...book, user_id: "reader-b" });
    rerender(<View />);
    await screen.findByRole("button", { name: "Log progress" });
    await act(async () => { releaseLocal(null); });
    expect(mocks.remote).not.toHaveBeenCalled();
    expect(mocks.hydrate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Log progress" })).toBeVisible();
  });

  it("does not hydrate a remote response after its reader has changed", async () => {
    let releaseRemote!: (value: typeof book) => void;
    mocks.local.mockResolvedValueOnce(null);
    mocks.remote.mockReturnValueOnce(new Promise<typeof book>(resolve => { releaseRemote = resolve; }));
    const { rerender } = render(<View />);
    await waitFor(() => expect(mocks.remote).toHaveBeenCalledTimes(1));
    mocks.auth = { user: { id: "reader-b" }, loading: false };
    mocks.local.mockResolvedValue({ ...book, user_id: "reader-b" });
    rerender(<View />);
    await screen.findByRole("button", { name: "Log progress" });
    await act(async () => { releaseRemote(book); });
    expect(mocks.hydrate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Log progress" })).toBeVisible();
  });
});
