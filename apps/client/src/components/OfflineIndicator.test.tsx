import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  online: true, getStatus: vi.fn(), syncCurrentUser: vi.fn(), toast: vi.fn(),
}));
vi.mock("@/hooks/useNetworkStatus", () => ({ useNetworkStatus: () => mocks.online }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
vi.mock("@/services/sync/engine", () => ({
  readingCoreSync: { getStatus: mocks.getStatus, syncCurrentUser: mocks.syncCurrentUser },
  SYNC_STATUS_EVENT: "brack:test-sync-status",
}));
vi.mock("@/components/SyncReviewDialog", () => ({
  SyncReviewDialog: ({ open }: { open: boolean }) => open ? <div role="dialog" aria-label="Review reading changes" /> : null,
}));
import { OfflineIndicator } from "./OfflineIndicator";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.online = true;
  mocks.getStatus.mockResolvedValue({ pending: 0, failed: 0, syncing: 0 });
});

describe("shell reading sync status", () => {
  it("keeps healthy sync silent and provides a polite offline status", async () => {
    const view = render(<OfflineIndicator />);
    await waitFor(() => expect(mocks.getStatus).toHaveBeenCalledOnce());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    mocks.online = false;
    view.rerender(<OfflineIndicator />);
    expect(screen.getByRole("status")).toHaveTextContent("Reading changes save locally");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps failures reviewable without reporting them as synced", async () => {
    mocks.getStatus.mockResolvedValue({ pending: 0, failed: 2, syncing: 0 });
    render(<OfflineIndicator />);
    expect(await screen.findByRole("status")).toHaveTextContent("2 reading changes need review");
    fireEvent.click(screen.getByRole("button", { name: "Review reading changes" }));
    expect(screen.getByRole("dialog", { name: "Review reading changes" })).toBeInTheDocument();
    expect(mocks.syncCurrentUser).not.toHaveBeenCalled();
  });

  it("retains automatic sync, blocks duplicate manual retry and reports completion", async () => {
    const pending = { pending: 2, failed: 0, syncing: 0 };
    mocks.getStatus.mockResolvedValue(pending);
    mocks.syncCurrentUser.mockResolvedValueOnce(pending);
    render(<OfflineIndicator />);
    await waitFor(() => expect(mocks.syncCurrentUser).toHaveBeenCalledWith({ forcePending: false }));
    const retry = await screen.findByRole("button", { name: "Sync reading changes now" });
    let complete!: (status: typeof pending) => void;
    mocks.syncCurrentUser.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    fireEvent.click(retry);
    fireEvent.click(retry);
    expect(mocks.syncCurrentUser).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Syncing reading changes" })).toBeDisabled();
    await act(async () => { complete({ pending: 0, failed: 0, syncing: 0 }); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(mocks.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Sync complete" }));
  });
});
