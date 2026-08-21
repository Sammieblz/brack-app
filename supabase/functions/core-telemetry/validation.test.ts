import {
  cleanTelemetryMetadata,
  isAllowedTelemetryEvent,
  requiresAuthenticatedTelemetry,
  TelemetryValidationError,
} from "./validation.ts";

const assertEquals = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
};

const assertValidationFailure = (callback: () => unknown) => {
  let error: unknown;
  try {
    callback();
  } catch (caught) {
    error = caught;
  }
  if (!(error instanceof TelemetryValidationError)) {
    throw new Error("Expected telemetry validation to fail");
  }
};

Deno.test("allows the three authenticated Journey events", () => {
  for (
    const eventName of [
      "journey_opened",
      "journey_tab_viewed",
      "daily_focus_started",
    ]
  ) {
    assertEquals(isAllowedTelemetryEvent(eventName), true);
    assertEquals(requiresAuthenticatedTelemetry(eventName), true);
  }
});

Deno.test("validates enumerated Journey metadata", () => {
  assertEquals(
    cleanTelemetryMetadata("journey_tab_viewed", {
      source: "dashboard_hud",
      destination_tab: "quests",
      freshness: "cached",
    }),
    {
      source: "dashboard_hud",
      destination_tab: "quests",
      freshness: "cached",
    },
  );

  assertEquals(
    cleanTelemetryMetadata("daily_focus_started", {
      source: "dashboard_daily_focus",
      quest_metric: "reading_minutes",
      freshness: "live",
    }),
    {
      source: "dashboard_daily_focus",
      quest_metric: "reading_minutes",
      freshness: "live",
    },
  );
});

Deno.test("rejects unknown, sensitive, or invalid Journey metadata", () => {
  assertValidationFailure(() =>
    cleanTelemetryMetadata("journey_opened", {
      source: "dashboard",
      email: "reader@example.com",
    })
  );
  assertValidationFailure(() =>
    cleanTelemetryMetadata("journey_tab_viewed", {
      source: "dashboard_hud",
      destination_tab: "not-a-tab",
    })
  );
  assertValidationFailure(() =>
    cleanTelemetryMetadata("daily_focus_started", {
      source: "dashboard_daily_focus",
      quest_metric: "reader-name",
    })
  );
});

Deno.test("preserves the existing bounded metadata contract for legacy events", () => {
  const metadata = { provider: "open-library", result_count: 4 };
  assertEquals(
    cleanTelemetryMetadata("book_search_succeeded", metadata),
    metadata,
  );
  assertEquals(requiresAuthenticatedTelemetry("book_search_succeeded"), false);
});
