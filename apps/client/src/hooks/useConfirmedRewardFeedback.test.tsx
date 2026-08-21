import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfirmedRewardFeedbackOptions } from "./useConfirmedRewardFeedback";
import { useConfirmedRewardFeedback } from "./useConfirmedRewardFeedback";

const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
}));

vi.mock("@/contexts/RewardFeedbackContext", () => ({
  useRewardFeedback: () => ({ publishConfirmedRewards: mocks.publish }),
}));

const reward = (
  id: string,
  ink = 10,
  goldLeaves = 1,
) => ({ id, ink_delta: ink, gold_leaves_delta: goldLeaves });

const options = (
  overrides: Partial<ConfirmedRewardFeedbackOptions> = {},
): ConfirmedRewardFeedbackOptions => ({
  userId: "reader-1",
  rewards: [reward("baseline")],
  source: "live",
  freshness: "live",
  provisional: false,
  hasCurrentSessionLiveResponse: true,
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  mocks.publish.mockReset();
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
});

afterEach(() => vi.restoreAllMocks());

describe("useConfirmedRewardFeedback", () => {
  it("primes from the first session-live response without replaying a stored cursor", () => {
    localStorage.setItem("brack:journey:last-seen-reward:reader-1", "stale-storage-id");
    const { rerender } = renderHook(
      ({ value }) => useConfirmedRewardFeedback(value),
      { initialProps: { value: options() } },
    );

    expect(mocks.publish).not.toHaveBeenCalled();
    expect(localStorage.getItem("brack:journey:last-seen-reward:reader-1"))
      .toBe("baseline");

    rerender({ value: options({ rewards: [reward("new"), reward("baseline")] }) });
    expect(mocks.publish).toHaveBeenCalledWith({
      userId: "reader-1",
      id: "new",
      rewardCount: 1,
      ink: 10,
      goldLeaves: 1,
    });
  });

  it("does not prime or publish cached, provisional, or unconfirmed session data", () => {
    const { rerender } = renderHook(
      ({ value }) => useConfirmedRewardFeedback(value),
      {
        initialProps: {
          value: options({
            source: "cached",
            freshness: "cached",
            hasCurrentSessionLiveResponse: false,
          }),
        },
      },
    );
    rerender({ value: options({ provisional: true }) });
    expect(mocks.publish).not.toHaveBeenCalled();

    rerender({ value: options() });
    expect(mocks.publish).not.toHaveBeenCalled();
    rerender({ value: options({ rewards: [reward("new"), reward("baseline")] }) });
    expect(mocks.publish).toHaveBeenCalledOnce();
  });

  it("aggregates positive Ink and Gold Leaves while excluding every debit", () => {
    const { rerender } = renderHook(
      ({ value }) => useConfirmedRewardFeedback(value),
      { initialProps: { value: options() } },
    );

    rerender({
      value: options({
        rewards: [
          reward("gold", -8, 3),
          reward("ink", 25, 0),
          reward("purchase", 0, -12),
          reward("baseline"),
        ],
      }),
    });

    expect(mocks.publish).toHaveBeenCalledWith({
      userId: "reader-1",
      id: "gold",
      rewardCount: 2,
      ink: 25,
      goldLeaves: 3,
    });
  });

  it("keeps confirmed feedback pending while blocked and flushes it once", () => {
    const { rerender } = renderHook(
      ({ value }) => useConfirmedRewardFeedback(value),
      { initialProps: { value: options() } },
    );

    const blocked = options({
      rewards: [reward("new"), reward("baseline")],
      blocked: true,
    });
    rerender({ value: blocked });
    expect(mocks.publish).not.toHaveBeenCalled();

    rerender({ value: { ...blocked, blocked: false } });
    expect(mocks.publish).toHaveBeenCalledOnce();
    rerender({ value: { ...blocked, blocked: false } });
    expect(mocks.publish).toHaveBeenCalledOnce();
  });

  it("advances its cursor but suppresses feedback while the document is unfocused", () => {
    const { rerender } = renderHook(
      ({ value }) => useConfirmedRewardFeedback(value),
      { initialProps: { value: options() } },
    );

    vi.mocked(document.hasFocus).mockReturnValue(false);
    const hiddenWindow = options({
      rewards: [reward("background"), reward("baseline")],
    });
    rerender({ value: hiddenWindow });
    expect(mocks.publish).not.toHaveBeenCalled();

    vi.mocked(document.hasFocus).mockReturnValue(true);
    rerender({ value: hiddenWindow });
    expect(mocks.publish).not.toHaveBeenCalled();

    rerender({
      value: options({
        rewards: [reward("foreground"), reward("background"), reward("baseline")],
      }),
    });
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ id: "foreground" }));
  });
});
