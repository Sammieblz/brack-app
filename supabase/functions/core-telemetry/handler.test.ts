import { createCoreTelemetryHandler } from "./index.ts";

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

const telemetryRequest = (body: Record<string, unknown>, token?: string) =>
  new Request("http://localhost/functions/v1/core-telemetry", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

const makeClient = (onInsert: (row: Record<string, unknown>) => void) => ({
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
  },
  from: (table: string) => ({
    insert: async (row: Record<string, unknown>) => {
      if (table !== "core_telemetry_events") {
        return { error: new Error(`Unexpected table: ${table}`) };
      }
      onInsert(row);
      return { error: null };
    },
  }),
});

Deno.test(
  "telemetry handler rejects unsupported methods before dependencies",
  async () => {
    const handler = createCoreTelemetryHandler({
      createServiceClient: (() => {
        throw new Error("Dependencies must not run for an unsupported method");
      }) as never,
      jsonResponse: testJsonResponse as never,
    });
    const response = await handler(
      new Request("http://localhost/functions/v1/core-telemetry", {
        method: "GET",
      }),
    );
    assertEquals(response.status, 405);
  },
);

Deno.test(
  "telemetry handler requires authentication for Journey events",
  async () => {
    let inserted = false;
    const handler = createCoreTelemetryHandler({
      createServiceClient: (() => makeClient(() => inserted = true)) as never,
      getAuthenticatedUser: (async () => ({
        response: new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        }),
      })) as never,
      jsonResponse: testJsonResponse as never,
    });
    const response = await handler(telemetryRequest({
      event_name: "journey_opened",
      metadata: { source: "dashboard" },
    }));
    assertEquals(response.status, 401);
    assertEquals(inserted, false);
  },
);

Deno.test(
  "telemetry handler derives the Journey user from verified auth",
  async () => {
    let inserted: Record<string, unknown> | null = null;
    const handler = createCoreTelemetryHandler({
      createServiceClient: (() => makeClient((row) => inserted = row)) as never,
      getAuthenticatedUser:
        (async () => ({ user: { id: "verified-user" } })) as never,
      enforceRateLimit: (async () => null) as never,
      jsonResponse: testJsonResponse as never,
    });
    const response = await handler(telemetryRequest({
      event_name: "journey_tab_viewed",
      platform: "web",
      metadata: {
        source: "dashboard_hud",
        destination_tab: "quests",
        freshness: "live",
      },
    }, "valid-token"));
    assertEquals(response.status, 202);
    const insertedRow = inserted as Record<string, unknown> | null;
    assertEquals(insertedRow?.user_id, "verified-user");
    assertEquals(insertedRow?.event_name, "journey_tab_viewed");
  },
);

Deno.test("telemetry handler preserves anonymous legacy telemetry", async () => {
  let inserted: Record<string, unknown> | null = null;
  const handler = createCoreTelemetryHandler({
    createServiceClient: (() => makeClient((row) => inserted = row)) as never,
    getAuthenticatedUser: (async () => {
      throw new Error("Legacy anonymous telemetry must not require user auth");
    }) as never,
    enforceRateLimit: (async () => null) as never,
    jsonResponse: testJsonResponse as never,
  });
  const response = await handler(telemetryRequest({
    event_name: "book_search_succeeded",
    metadata: { provider: "open-library", result_count: 1 },
  }));
  assertEquals(response.status, 202);
  const insertedRow = inserted as Record<string, unknown> | null;
  assertEquals(insertedRow?.user_id, null);
  assertEquals(insertedRow?.event_name, "book_search_succeeded");
});
