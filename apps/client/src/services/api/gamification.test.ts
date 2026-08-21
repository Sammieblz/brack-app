import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GamificationHomeResponse, LeaderboardResponse } from "./gamification";

const mocks = vi.hoisted(() => ({
  invokeFunction: vi.fn(),
  getCurrentAuthUser: vi.fn(),
}));

vi.mock("./client", () => ({
  invokeFunction: mocks.invokeFunction,
  getApiErrorStatus: (error: { status?: number }) => error.status ?? null,
}));

vi.mock("./auth", () => ({
  getCurrentAuthUser: mocks.getCurrentAuthUser,
}));

vi.mock("@/services/connectivity", () => ({
  isConnectivityAvailable: () => true,
  isRetryableConnectivityError: (error: { retryable?: boolean }) => Boolean(error.retryable),
}));

vi.mock("@/services/local", () => ({
  profilePreferencesRepo: {},
}));

vi.mock("@/services/sync/engine", () => ({
  readingCoreSync: {},
}));

import {
  cacheGamificationHomeResponse,
  getGamificationHome,
  getGamificationShop,
  getLeaderboard,
} from "./gamification";

const response: LeaderboardResponse = {
  week: {
    id: "week-1",
    week_start: "2026-08-10",
    week_end: "2026-08-17",
    scoring_closes_at: "2026-08-17T06:00:00Z",
    status: "active",
    finalized_at: null,
  },
  scope: "league",
  entries: [],
};

const shopResponse = {
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
};

const homeResponse: GamificationHomeResponse = {
  account: {
    user_id: "reader-1",
    lifetime_ink: 140,
    gold_leaves: 25,
    current_level: 2,
    level_title: "Page Turner",
    level_threshold: 100,
    next_level: { level: 3, title: "Bookbound", ink_threshold: 300 },
    leaderboard_opt_in: true,
    leaderboard_eligible_from: null,
    gamification_profile_visible: true,
  },
  quests: [],
  tomorrow_quests: [],
  recent_rewards: [],
  league: null,
  week: response.week,
  server_time: "2026-08-11T12:00:00Z",
  timezone: "America/New_York",
};

describe("leaderboard cache policy", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.invokeFunction.mockReset();
    mocks.getCurrentAuthUser.mockReset();
    mocks.getCurrentAuthUser.mockResolvedValue({ id: "reader-1" });
  });

  it("marks successful responses live and caches the server payload", async () => {
    mocks.invokeFunction.mockResolvedValue(response);

    await expect(getLeaderboard("reader-1", "league", "week-1")).resolves.toMatchObject({
      source: "live",
      scope: "league",
    });
  });

  it("uses cached standings for retryable failures", async () => {
    mocks.getCurrentAuthUser.mockRejectedValue(new Error("Auth server is offline"));
    mocks.invokeFunction.mockResolvedValueOnce(response);
    await getLeaderboard("reader-1", "league", "week-1");
    mocks.invokeFunction.mockRejectedValueOnce({ status: 503 });

    await expect(getLeaderboard("reader-1", "league", "week-1")).resolves.toMatchObject({
      source: "cached",
      scope: "league",
    });
    expect(mocks.getCurrentAuthUser).not.toHaveBeenCalled();
  });

  it("never masks authentication failures with cached data", async () => {
    mocks.invokeFunction.mockResolvedValueOnce(response);
    await getLeaderboard("reader-1", "league", "week-1");
    mocks.invokeFunction.mockRejectedValueOnce({ status: 401 });

    await expect(getLeaderboard("reader-1", "league", "week-1")).rejects.toMatchObject({ status: 401 });
  });

  it("keeps a user-scoped shop snapshot read-only during retryable failures", async () => {
    mocks.invokeFunction.mockResolvedValueOnce(shopResponse);
    await expect(getGamificationShop("reader-1")).resolves.toMatchObject({ source: "live" });
    mocks.invokeFunction.mockRejectedValueOnce({ status: 503 });

    await expect(getGamificationShop("reader-1")).resolves.toMatchObject({
      source: "cached",
      cached_at: expect.any(String),
      account: { user_id: "reader-1", gold_leaves: 25 },
    });
  });

  it("never exposes a shop snapshot for auth failures or a different user", async () => {
    mocks.invokeFunction.mockResolvedValueOnce(shopResponse);
    await getGamificationShop("reader-1");

    mocks.invokeFunction.mockRejectedValueOnce({ status: 401 });
    await expect(getGamificationShop("reader-1")).rejects.toMatchObject({ status: 401 });

    mocks.invokeFunction.mockRejectedValueOnce({ status: 503 });
    await expect(getGamificationShop("reader-2")).rejects.toMatchObject({ status: 503 });
  });

  it("keeps a versioned user-scoped Journey snapshot for retryable failures", async () => {
    mocks.invokeFunction.mockResolvedValueOnce(homeResponse);
    await expect(getGamificationHome("reader-1")).resolves.toMatchObject({
      source: "live",
      cached_at: null,
    });

    mocks.invokeFunction.mockRejectedValueOnce({ status: 503 });
    await expect(getGamificationHome("reader-1")).resolves.toMatchObject({
      source: "cached",
      cached_at: expect.any(String),
      account: { user_id: "reader-1", lifetime_ink: 140 },
    });
  });

  it("never masks Journey authentication failures with saved progress", async () => {
    mocks.invokeFunction.mockResolvedValueOnce(homeResponse);
    await getGamificationHome("reader-1");

    mocks.invokeFunction.mockRejectedValueOnce({ status: 401 });
    await expect(getGamificationHome("reader-1")).rejects.toMatchObject({ status: 401 });
  });

  it("rejects malformed Journey snapshots instead of exposing partial current-cycle data", async () => {
    localStorage.setItem("brack:gamification-home:v2:reader-1", JSON.stringify({
      version: 2,
      savedAt: "2026-08-11T12:00:00Z",
      data: {
        account: homeResponse.account,
        quests: [],
        tomorrow_quests: [],
        recent_rewards: [],
        server_time: "not-a-date",
        timezone: "America/New_York",
      },
    }));
    mocks.invokeFunction.mockRejectedValueOnce({ status: 503 });

    await expect(getGamificationHome("reader-1")).rejects.toMatchObject({ status: 503 });
  });

  it("does not persist a combined Dashboard Journey payload under another user", () => {
    cacheGamificationHomeResponse("reader-2", homeResponse);

    expect(localStorage.getItem("brack:gamification-home:v2:reader-2")).toBeNull();
  });
});
