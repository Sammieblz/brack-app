import { createDashboardHomeHandler } from "./index.ts";

type RpcCall = { name: string; args: Record<string, unknown> };
type RateLimitCall = { name?: string; limit: number; windowMs: number };

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const assertEquals = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
};

const testJsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const testOptionsResponse = () => new Response(null, { status: 204 });

const jsonBody = (value: Record<string, unknown>) => ({
  method: "POST",
  headers: {
    Authorization: "Bearer test-token",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(value),
});

const core = {
  continueBooks: [],
  activeGoal: null,
  today: { minutes: 0, sessionCount: 0, progressLogCount: 0 },
  streak: { currentStreak: 0, longestStreak: 0 },
  stats: { totalBooks: 0 },
  recentActivity: [],
  achievements: [],
};

const gamification = {
  account: { user_id: "user-1", lifetime_ink: 135, gold_leaves: 4 },
  quests: [{ id: "quest-1", cadence: "daily" }],
  tomorrow_quests: [{ id: "quest-tomorrow" }],
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
  league: null,
  week: { id: "week-1", week_end: "2026-08-16" },
  server_time: "2026-08-11T12:00:00.000Z",
  timezone: "America/New_York",
};

const shop = {
  items: [{
    code: "streak_freeze",
    display_name: "Streak Freeze",
    description: "Protect a reading day",
    gold_leaves_cost: 1,
    max_inventory: 3,
    quantity: 2,
    can_purchase: true,
  }],
};

const makeHandler = (
  rpcResults: Record<string, { data: unknown; error: unknown }>,
  rateLimit?: (
    call: RateLimitCall,
  ) => Response | null,
) => {
  const rpcCalls: RpcCall[] = [];
  const rateLimitCalls: RateLimitCall[] = [];
  const client = {
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve(
        rpcResults[name] ??
          { data: null, error: new Error(`Unexpected RPC: ${name}`) },
      );
    },
  };
  const handler = createDashboardHomeHandler({
    createServiceClient: (() => client) as never,
    getAuthenticatedUser: (async () => ({
      user: { id: "user-1" },
    })) as never,
    enforceRateLimit: (async (
      _request: Request,
      _client: unknown,
      options: RateLimitCall,
    ) => {
      rateLimitCalls.push(options);
      return rateLimit?.(options) ?? null;
    }) as never,
    jsonResponse: testJsonResponse as never,
    optionsResponse: testOptionsResponse as never,
  });
  return { handler, rpcCalls, rateLimitCalls };
};

Deno.test(
  "dashboard handler rejects unsupported methods with no-store",
  async () => {
    const handler = createDashboardHomeHandler({
      createServiceClient: (() => {
        throw new Error("Dependencies must not run for an unsupported method");
      }) as never,
      jsonResponse: testJsonResponse as never,
    });
    const response = await handler(
      new Request("http://localhost/functions/v1/dashboard-home", {
        method: "PUT",
      }),
    );
    assertEquals(response.status, 405);
    assertEquals(response.headers.get("cache-control"), "private, no-store");
  },
);

Deno.test(
  "dashboard handler preserves authenticated failures and no-store",
  async () => {
    const handler = createDashboardHomeHandler({
      createServiceClient: (() => ({})) as never,
      getAuthenticatedUser: (async () => ({
        response: new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      })) as never,
      jsonResponse: testJsonResponse as never,
    });
    const response = await handler(
      new Request("http://localhost/functions/v1/dashboard-home", {
        method: "GET",
      }),
    );
    assertEquals(response.status, 401);
    assertEquals(response.headers.get("cache-control"), "private, no-store");
  },
);

Deno.test(
  "dashboard handler keeps the legacy response byte-shape additive-free",
  async () => {
    const { handler, rpcCalls, rateLimitCalls } = makeHandler({
      get_dashboard_home_snapshot: { data: core, error: null },
    });
    const response = await handler(
      new Request(
        "http://localhost/functions/v1/dashboard-home",
        jsonBody({ recent_limit: 12 }),
      ),
    );
    assertEquals(response.status, 200);
    assertEquals(await response.json(), core);
    assertEquals(response.headers.get("cache-control"), "private, no-store");
    assertEquals(rpcCalls, [{
      name: "get_dashboard_home_snapshot",
      args: { p_user_id: "user-1", p_recent_limit: 12, p_max_age_seconds: 300 },
    }]);
    assertEquals(rateLimitCalls.map((call) => [call.name, call.limit]), [
      ["dashboard-home", 120],
    ]);
  },
);

Deno.test(
  "dashboard handler clamps zero recent limits consistently for GET and POST",
  async () => {
    const requests = [
      new Request(
        "http://localhost/functions/v1/dashboard-home?recent_limit=0",
        { method: "GET", headers: { Authorization: "Bearer test-token" } },
      ),
      new Request(
        "http://localhost/functions/v1/dashboard-home",
        jsonBody({ recent_limit: 0 }),
      ),
    ];

    for (const request of requests) {
      const { handler, rpcCalls } = makeHandler({
        get_dashboard_home_snapshot: { data: core, error: null },
      });
      const response = await handler(request);
      assertEquals(response.status, 200);
      assertEquals(rpcCalls[0]?.args.p_recent_limit, 1);
    }
  },
);

Deno.test(
  "dashboard handler returns the complete v2 Journey payload",
  async () => {
    const { handler } = makeHandler({
      get_dashboard_home_snapshot: { data: core, error: null },
      get_gamification_home: { data: gamification, error: null },
      get_gamification_shop: { data: shop, error: null },
    });
    const response = await handler(
      new Request(
        "http://localhost/functions/v1/dashboard-home",
        jsonBody({ include_journey: true }),
      ),
    );
    const body = await response.json();
    assertEquals(response.status, 200);
    assertEquals(response.headers.get("cache-control"), "private, no-store");
    assertEquals(body.journey.tomorrow_quests, gamification.tomorrow_quests);
    assertEquals(body.journey.recent_rewards, gamification.recent_rewards);
    assertEquals(body.journey.latest_milestone.id, "reward-1");
    assertEquals(body.journey.streak_freeze.quantity, 2);
    assertEquals(body.meta.schema_version, 2);
    assertEquals(body.meta.journey_status, "ok");
    assertEquals(body.meta.inventory_status, "ok");
  },
);

Deno.test(
  "dashboard handler degrades a Journey RPC failure without failing core",
  async () => {
    const { handler } = makeHandler({
      get_dashboard_home_snapshot: { data: core, error: null },
      get_gamification_home: {
        data: null,
        error: new Error("database detail"),
      },
      get_gamification_shop: { data: shop, error: null },
    });
    const response = await handler(
      new Request(
        "http://localhost/functions/v1/dashboard-home",
        jsonBody({ include_journey: true }),
      ),
    );
    const body = await response.json();
    assertEquals(response.status, 200);
    assertEquals(body.journey, null);
    assertEquals(body.meta.journey_status, "unavailable");
    assert(
      !("error" in body),
      "Partial RPC details must not leak to the client",
    );
  },
);

Deno.test(
  "dashboard handler enforces the forced-refresh bucket before RPCs",
  async () => {
    const { handler, rpcCalls, rateLimitCalls } = makeHandler(
      { get_dashboard_home_snapshot: { data: core, error: null } },
      (call) =>
        call.name === "dashboard-home-force-refresh"
          ? new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429,
          })
          : null,
    );
    const response = await handler(
      new Request(
        "http://localhost/functions/v1/dashboard-home",
        jsonBody({ include_journey: true, force_refresh: true }),
      ),
    );
    assertEquals(response.status, 429);
    assertEquals(response.headers.get("cache-control"), "private, no-store");
    assertEquals(rateLimitCalls.map((call) => [call.name, call.limit]), [
      ["dashboard-home-journey", 60],
      ["dashboard-home-force-refresh", 12],
    ]);
    assertEquals(rpcCalls, []);
  },
);
