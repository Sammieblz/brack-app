import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RewardFeedbackProvider,
  useRewardFeedback,
  type ConfirmedRewardFeedbackBatch,
} from "./RewardFeedbackContext";

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: "reader-1" } as { id: string } | null,
    loading: false,
  },
  reducedMotion: true,
  triggerHaptic: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => mocks.reducedMotion,
}));

vi.mock("@/hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({ triggerHaptic: mocks.triggerHaptic }),
}));

const rewardBatch = (
  userId = "reader-1",
  id = "reward-1",
): ConfirmedRewardFeedbackBatch => ({
  userId,
  id,
  rewardCount: 2,
  ink: 25,
  goldLeaves: 3,
});

const FeedbackHarness = ({ batch, withTargets = false }: {
  batch: ConfirmedRewardFeedbackBatch;
  withTargets?: boolean;
}) => {
  const feedback = useRewardFeedback();

  useLayoutEffect(() => {
    if (!withTargets) return undefined;
    const ink = document.querySelector<HTMLElement>("[data-test-reward-target='ink']");
    const gold = document.querySelector<HTMLElement>("[data-test-reward-target='goldLeaves']");
    feedback.registerHudTarget("ink", ink);
    feedback.registerHudTarget("goldLeaves", gold);
    return () => {
      feedback.registerHudTarget("ink", null);
      feedback.registerHudTarget("goldLeaves", null);
    };
  }, [feedback, withTargets]);

  return (
    <>
      <button type="button" onClick={() => feedback.publishConfirmedRewards(batch)}>
        Publish reward
      </button>
      {withTargets && (
        <>
          <div data-test-reward-target="ink" />
          <div data-test-reward-target="goldLeaves" />
        </>
      )}
    </>
  );
};

beforeEach(() => {
  mocks.auth.user = { id: "reader-1" };
  mocks.auth.loading = false;
  mocks.reducedMotion = true;
  mocks.triggerHaptic.mockReset();
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
});

afterEach(() => vi.restoreAllMocks());

describe("RewardFeedbackProvider", () => {
  it("keeps one pre-mounted polite announcement and does not haptically signal reduced motion", () => {
    render(
      <RewardFeedbackProvider>
        <FeedbackHarness batch={rewardBatch()} />
      </RewardFeedbackProvider>,
    );

    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    expect(screen.getAllByRole("status")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Publish reward" }));
    expect(status).toHaveTextContent("2 rewards confirmed: +25 Ink and +3 Gold Leaves.");
    expect(mocks.triggerHaptic).not.toHaveBeenCalled();
  });

  it("marks the visual flight as active and keeps the exact aggregate amounts visible", () => {
    mocks.reducedMotion = false;
    render(
      <RewardFeedbackProvider>
        <FeedbackHarness batch={rewardBatch()} withTargets />
      </RewardFeedbackProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish reward" }));
    expect(document.querySelector('[data-brack-celebration-active="reward"]'))
      .toBeInTheDocument();
    expect(screen.getByText("+25")).toBeInTheDocument();
    expect(screen.getByText("+3")).toBeInTheDocument();
  });

  it("cancels an in-flight presentation if the document loses focus", () => {
    mocks.reducedMotion = false;
    render(
      <RewardFeedbackProvider>
        <FeedbackHarness batch={rewardBatch()} withTargets />
      </RewardFeedbackProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish reward" }));
    expect(document.querySelector('[data-brack-celebration-active="reward"]'))
      .toBeInTheDocument();

    vi.mocked(document.hasFocus).mockReturnValue(false);
    act(() => window.dispatchEvent(new Event("blur")));

    expect(document.querySelector('[data-brack-celebration-active="reward"]'))
      .not.toBeInTheDocument();
    expect(mocks.triggerHaptic).not.toHaveBeenCalled();
  });

  it("fires at most one success haptic for a full-motion aggregate batch", async () => {
    mocks.reducedMotion = false;
    render(
      <RewardFeedbackProvider>
        <FeedbackHarness batch={rewardBatch()} />
      </RewardFeedbackProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish reward" }));
    await waitFor(() => expect(mocks.triggerHaptic).toHaveBeenCalledOnce());
    expect(mocks.triggerHaptic).toHaveBeenCalledWith("success");
  });

  it("cancels queued feedback on an authenticated-user switch", () => {
    mocks.reducedMotion = false;
    const { rerender } = render(
      <RewardFeedbackProvider>
        <FeedbackHarness batch={rewardBatch()} withTargets />
      </RewardFeedbackProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish reward" }));
    expect(document.querySelector('[data-brack-celebration-active="reward"]'))
      .toBeInTheDocument();

    mocks.auth.user = { id: "reader-2" };
    rerender(
      <RewardFeedbackProvider>
        <FeedbackHarness batch={rewardBatch("reader-2")} withTargets />
      </RewardFeedbackProvider>,
    );

    expect(document.querySelector('[data-brack-celebration-active="reward"]'))
      .not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
