import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const refetch = vi.fn();
  const mutateAsync = vi.fn();
  const toastError = vi.fn();
  const toastSuccess = vi.fn();
  return {
    refetch,
    mutateAsync,
    toastError,
    toastSuccess,
    shopState: {
      data: {
        account: { user_id: "reader-1", gold_leaves: 25 },
        items: [{
          code: "streak_freeze",
          display_name: "Streak Freeze",
          description: "Protect a streak",
          item_type: "consumable",
          gold_leaves_cost: 10,
          max_inventory: 3,
          quantity: 1,
          can_purchase: true,
          config: {},
        }],
        source: "cached" as "cached" | "live",
        cached_at: "2026-08-11T12:00:00Z" as string | null,
      },
      isLoading: false,
      isFetching: false,
      isFetchedAfterMount: true,
      hasCurrentSessionLiveResponse: false,
      error: null as unknown,
      refetch,
      purchaseMutation: {
        isPending: false,
        variables: undefined,
        mutateAsync,
      },
    },
  };
});

vi.mock("@/hooks/useGamification", () => ({
  useGamificationShop: () => mocks.shopState,
}));

vi.mock("@/hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({ triggerHaptic: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

import { JourneyShop } from "./JourneyShop";

describe("JourneyShop cached state", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.shopState.data.source = "cached";
    mocks.shopState.data.cached_at = "2026-08-11T12:00:00Z";
    mocks.shopState.data.account.gold_leaves = 25;
    mocks.shopState.error = null;
    mocks.shopState.isFetching = false;
    mocks.shopState.isFetchedAfterMount = true;
    mocks.shopState.hasCurrentSessionLiveResponse = false;
    mocks.mutateAsync.mockReset();
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
    localStorage.clear();
  });

  it("keeps the wallet visible but prevents offline purchases", () => {
    render(<JourneyShop userId="reader-1" />);

    expect(screen.getByText(/Saved wallet and inventory shown/i)).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconnect to buy" })).toBeDisabled();
  });

  it("keeps retained live wallet data visible and read-only after a retryable refetch error", () => {
    mocks.shopState.data.source = "live";
    mocks.shopState.data.cached_at = null;
    mocks.shopState.error = { status: 503 };

    render(<JourneyShop userId="reader-1" />);

    expect(screen.getByText(/Saved wallet and inventory shown/i)).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconnect to buy" })).toBeDisabled();
  });

  it("keeps a large wallet balance within the compact hero", () => {
    mocks.shopState.data.account.gold_leaves = 9_999_999_999;

    render(<JourneyShop userId="reader-1" />);

    const balance = screen.getByRole("heading", { name: "9,999,999,999" });
    expect(balance).toHaveClass("truncate", "text-2xl", "sm:text-3xl");
    expect(balance).toHaveAttribute("title", "9,999,999,999");
  });

  it("treats a rehydrated live snapshot as read-only until a current-session fetch succeeds", () => {
    mocks.shopState.data.source = "live";
    mocks.shopState.data.cached_at = null;
    mocks.shopState.isFetchedAfterMount = false;
    mocks.shopState.hasCurrentSessionLiveResponse = false;
    mocks.shopState.isFetching = true;

    const view = render(<JourneyShop userId="reader-1" />);

    expect(screen.getByText(/Saved wallet and inventory shown/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconnect to buy" })).toBeDisabled();

    mocks.shopState.isFetchedAfterMount = true;
    mocks.shopState.isFetching = false;
    mocks.shopState.hasCurrentSessionLiveResponse = true;
    view.rerender(<JourneyShop userId="reader-1" />);

    expect(screen.getByRole("button", { name: "Buy" })).toBeEnabled();
  });

  it("reuses an ambiguous purchase key after closing and reopening confirmation", async () => {
    const user = userEvent.setup();
    mocks.shopState.data.source = "live";
    mocks.shopState.data.cached_at = null;
    mocks.shopState.hasCurrentSessionLiveResponse = true;
    mocks.mutateAsync
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce({
        idempotent: true,
        account: { user_id: "reader-1", gold_leaves: 15 },
        inventory: { item_code: "streak_freeze", quantity: 2, max_inventory: 3 },
      });

    render(<JourneyShop userId="reader-1" />);

    await user.click(screen.getByRole("button", { name: "Buy" }));
    await user.click(screen.getByRole("button", { name: "Confirm purchase" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(
      expect.stringContaining("outcome couldn't be confirmed"),
    ));
    const firstKey = mocks.mutateAsync.mock.calls[0][0].idempotencyKey;

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Buy" }));
    await user.click(screen.getByRole("button", { name: "Confirm purchase" }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2));

    expect(mocks.mutateAsync.mock.calls[1][0].idempotencyKey).toBe(firstKey);
    expect(Object.keys(localStorage).filter((key) =>
      key.startsWith("brack:shop-purchase-pending:v1:"))).toHaveLength(0);
  });

  it("refuses a purchase when its retry key cannot be stored durably", async () => {
    const user = userEvent.setup();
    mocks.shopState.data.source = "live";
    mocks.shopState.data.cached_at = null;
    mocks.shopState.hasCurrentSessionLiveResponse = true;
    const storageWrite = vi.spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Storage blocked", "SecurityError");
      });

    render(<JourneyShop userId="reader-1" />);
    await user.click(screen.getByRole("button", { name: "Buy" }));

    expect(mocks.toastError).toHaveBeenCalledWith(
      expect.stringContaining("Secure purchase retry is unavailable"),
    );
    expect(screen.queryByRole("button", { name: "Confirm purchase" }))
      .not.toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    storageWrite.mockRestore();
  });
});
