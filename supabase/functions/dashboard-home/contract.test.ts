import {
  buildDashboardHomeV2,
  buildJourneySummary,
  composeDashboardHomeV2,
  extractStreakFreeze,
  parseOptionalBoolean,
  selectLatestMilestone,
} from "./contract.ts";

const assertEquals = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
};

const dashboard = {
  continueBooks: [],
  achievements: [
    {
      id: "badge-1",
      title: "First chapter",
      description: "Read the opening chapter",
      icon_url: "/badges/first.png",
      earned_at: "2026-08-11T10:00:00.000Z",
    },
  ],
};

const gamification = {
  account: { user_id: "user-1", lifetime_ink: 135 },
  quests: [{ id: "quest-1" }],
  tomorrow_quests: [{ id: "tomorrow-quest-1" }],
  league: null,
  week: { id: "week-1" },
  server_time: "2026-08-11T12:00:00.000Z",
  timezone: "America/New_York",
  recent_rewards: [
    {
      id: "purchase-1",
      display_name: "Gold Leaf shop purchase",
      event_type: "shop_purchase",
      ink_delta: 0,
      gold_leaves_delta: -1,
      created_at: "2026-08-11T11:30:00.000Z",
    },
    {
      id: "reward-1",
      display_name: "Daily pages",
      event_type: "quest_completed",
      ink_delta: 20,
      gold_leaves_delta: 1,
      created_at: "2026-08-11T11:00:00.000Z",
    },
  ],
};

const shop = {
  items: [
    {
      code: "streak_freeze",
      display_name: "Streak Freeze",
      description: "Protect a reading day",
      gold_leaves_cost: 1,
      max_inventory: 3,
      quantity: 2,
      can_purchase: true,
      config: { ignored: true },
    },
  ],
};

Deno.test("parses optional dashboard booleans without truthy coercion", () => {
  assertEquals(parseOptionalBoolean(undefined, "include_journey"), undefined);
  assertEquals(parseOptionalBoolean(false, "include_journey"), false);
  assertEquals(parseOptionalBoolean("1", "include_journey"), true);
  assertEquals(parseOptionalBoolean("false", "include_journey"), false);

  let rejected = false;
  try {
    parseOptionalBoolean("yes", "include_journey");
  } catch {
    rejected = true;
  }
  assertEquals(rejected, true);
});

Deno.test("extracts only the public streak freeze summary", () => {
  assertEquals(extractStreakFreeze(shop), {
    code: "streak_freeze",
    display_name: "Streak Freeze",
    description: "Protect a reading day",
    gold_leaves_cost: 1,
    max_inventory: 3,
    quantity: 2,
    can_purchase: true,
  });
});

Deno.test("selects the newest server-confirmed reward or badge milestone", () => {
  assertEquals(selectLatestMilestone(dashboard, gamification), {
    kind: "reward",
    id: "reward-1",
    title: "Daily pages",
    event_type: "quest_completed",
    ink_delta: 20,
    gold_leaves_delta: 1,
    earned_at: "2026-08-11T11:00:00.000Z",
  });
});

Deno.test("skips debit and zero ledger rows when selecting a reward milestone", () => {
  const onlyDebits = {
    ...gamification,
    recent_rewards: [
      gamification.recent_rewards[0],
      {
        id: "zero-1",
        display_name: "No-op reconciliation",
        event_type: "reconciliation",
        ink_delta: 0,
        gold_leaves_delta: 0,
        created_at: "2026-08-11T11:20:00.000Z",
      },
    ],
  };

  assertEquals(
    selectLatestMilestone({ ...dashboard, achievements: [] }, onlyDebits),
    null,
  );
});

Deno.test("builds the additive Journey summary and v2 metadata", () => {
  const journey = buildJourneySummary(dashboard, gamification, shop);
  const response = buildDashboardHomeV2(dashboard, journey, {
    served_at: "2026-08-11T12:00:01.000Z",
    journey_status: "ok",
    inventory_status: "ok",
  });

  assertEquals(response.continueBooks, []);
  assertEquals(response.journey?.streak_freeze?.quantity, 2);
  assertEquals(response.journey?.tomorrow_quests, gamification.tomorrow_quests);
  assertEquals(response.journey?.recent_rewards, gamification.recent_rewards);
  assertEquals(response.meta, {
    schema_version: 2,
    served_at: "2026-08-11T12:00:01.000Z",
    journey_status: "ok",
    inventory_status: "ok",
  });
});

Deno.test("keeps Journey usable when inventory is unavailable", () => {
  const journey = buildJourneySummary(dashboard, gamification, null);
  assertEquals(journey.streak_freeze, null);
  assertEquals(journey.account, gamification.account);
});

Deno.test("marks independent Journey and inventory failures without failing core", () => {
  const withoutJourney = composeDashboardHomeV2(
    { data: dashboard, error: null },
    { data: null, error: new Error("Journey RPC unavailable") },
    { data: shop, error: null },
    "2026-08-11T12:00:01.000Z",
  );
  assertEquals(withoutJourney.response.journey, null);
  assertEquals(withoutJourney.response.meta.journey_status, "unavailable");
  assertEquals(withoutJourney.response.meta.inventory_status, "ok");

  const withoutInventory = composeDashboardHomeV2(
    { data: dashboard, error: null },
    { data: gamification, error: null },
    { data: null, error: new Error("Shop RPC unavailable") },
    "2026-08-11T12:00:01.000Z",
  );
  assertEquals(withoutInventory.response.journey?.streak_freeze, null);
  assertEquals(withoutInventory.response.meta.journey_status, "ok");
  assertEquals(withoutInventory.response.meta.inventory_status, "unavailable");
});

Deno.test("treats the dashboard core as required", () => {
  const coreError = new Error("Dashboard RPC unavailable");
  let caught: unknown;
  try {
    composeDashboardHomeV2(
      { data: null, error: coreError },
      { data: gamification, error: null },
      { data: shop, error: null },
      "2026-08-11T12:00:01.000Z",
    );
  } catch (error) {
    caught = error;
  }
  assertEquals(caught === coreError, true);
});
