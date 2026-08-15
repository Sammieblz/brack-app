import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GamificationHomeResponse,
  GamificationShopResponse,
} from "@/services/api/gamification";

const mocks = vi.hoisted(() => ({
  getGamificationHome: vi.fn(),
  getGamificationShop: vi.fn(),
}));

vi.mock("@/services/api/gamification", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api/gamification")>();
  return {
    ...actual,
    getGamificationHome: mocks.getGamificationHome,
    getGamificationShop: mocks.getGamificationShop,
  };
});

vi.mock("@/services/sync/engine", () => ({
  SYNC_STATUS_EVENT: "brack:sync-status",
  readingCoreSync: {
    getStatus: vi.fn().mockResolvedValue({
      pending: 0,
      syncing: 0,
      failed: 0,
    }),
  },
}));

import {
  gamificationQueryKey,
  gamificationShopQueryKey,
  useGamification,
  useGamificationShop,
} from "./useGamification";

const home = (): GamificationHomeResponse => ({
  account: {
    user_id: "reader-1",
    lifetime_ink: 120,
    gold_leaves: 15,
    current_level: 2,
    level_title: "Page Turner",
    level_threshold: 100,
    next_level: { level: 3, title: "Bookbound", ink_threshold: 300 },
    leaderboard_opt_in: true,
    leaderboard_eligible_from: null,
    gamification_profile_visible: true,
  },
  quests: [{
    id: "daily-1",
    title: "Read today",
    description: "Read ten pages",
    cadence: "daily",
    metric: "pages_read",
    target_value: 10,
    progress_value: 2,
    reward_ink: 10,
    reward_gold_leaves: 0,
    status: "active",
    period_start: "2099-08-11",
    period_end: "2099-08-11",
    completed_at: null,
  }],
  tomorrow_quests: [],
  recent_rewards: [],
  league: null,
  week: {
    id: "week-1",
    week_start: "2099-08-10",
    week_end: "2099-08-16",
    scoring_closes_at: "2099-08-17T04:00:00Z",
    status: "active",
    finalized_at: null,
  },
  server_time: "2099-08-11T16:00:00Z",
  timezone: "America/New_York",
  source: "live",
  cached_at: null,
});

const shop = (): GamificationShopResponse => ({
  account: { user_id: "reader-1", gold_leaves: 15 },
  items: [{
    code: "streak_freeze",
    display_name: "Streak Freeze",
    description: "Protect a missed day",
    item_type: "consumable",
    gold_leaves_cost: 10,
    max_inventory: 3,
    quantity: 1,
    can_purchase: true,
    config: {},
  }],
  source: "live",
  cached_at: null,
});

const createHarness = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
};

beforeEach(() => {
  mocks.getGamificationHome.mockReset();
  mocks.getGamificationShop.mockReset();
});

describe("gamification hydration boundaries", () => {
  it("keeps a hydrated live Journey snapshot cached after a failed mount refetch", async () => {
    const { queryClient, wrapper } = createHarness();
    queryClient.setQueryData(gamificationQueryKey("reader-1"), home());
    mocks.getGamificationHome.mockRejectedValue({ status: 503 });

    const { result } = renderHook(() => useGamification("reader-1"), { wrapper });

    expect(result.current.data?.source).toBe("cached");
    expect(result.current.freshness).toBe("cached");
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data?.source).toBe("cached");
    expect(result.current.freshness).toBe("cached");
  });

  it("promotes Journey data to live only after a successful mount refetch", async () => {
    const { queryClient, wrapper } = createHarness();
    queryClient.setQueryData(gamificationQueryKey("reader-1"), home());
    mocks.getGamificationHome.mockResolvedValue(home());

    const { result } = renderHook(() => useGamification("reader-1"), { wrapper });
    expect(result.current.data?.source).toBe("cached");
    await waitFor(() => expect(result.current.data?.source).toBe("live"));
    expect(result.current.freshness).toBe("live");
  });

  it("does not treat a Dashboard cache write as a successful Shop fetch", async () => {
    const { queryClient, wrapper } = createHarness();
    queryClient.setQueryData(gamificationShopQueryKey("reader-1"), shop());
    let resolveShop: (value: GamificationShopResponse) => void = () => undefined;
    mocks.getGamificationShop.mockReturnValue(new Promise((resolve) => {
      resolveShop = resolve;
    }));

    const { result } = renderHook(() => useGamificationShop("reader-1"), { wrapper });
    expect(result.current.hasCurrentSessionLiveResponse).toBe(false);

    act(() => {
      queryClient.setQueryData(gamificationShopQueryKey("reader-1"), {
        ...shop(),
        account: { user_id: "reader-1", gold_leaves: 99 },
      });
    });
    expect(result.current.hasCurrentSessionLiveResponse).toBe(false);

    act(() => resolveShop(shop()));
    await waitFor(() => {
      expect(result.current.hasCurrentSessionLiveResponse).toBe(true);
    });
  });
});
