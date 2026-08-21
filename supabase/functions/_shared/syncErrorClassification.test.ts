import {
  getSyncErrorDetails,
  isRetryableSyncError,
} from "./syncErrorClassification.ts";

Deno.test("preserves messages from plain Supabase error objects", () => {
  const error = {
    code: "23503",
    message: "insert or update violates foreign key constraint",
  };

  if (getSyncErrorDetails(error).message !== error.message) {
    throw new Error("Expected the Supabase error message to be preserved");
  }
  if (isRetryableSyncError(error)) {
    throw new Error("Expected an integrity error to require user review");
  }
});

Deno.test("retries transient database and HTTP failures", () => {
  const retryable = [
    { code: "40001", message: "serialization failure" },
    { code: "40P01", message: "deadlock detected" },
    { code: "PGRST000", message: "database connection failed" },
    { status: 429, message: "rate limited" },
    { status: 503, message: "temporarily unavailable" },
  ];

  for (const error of retryable) {
    if (!isRetryableSyncError(error)) {
      throw new Error(`Expected ${JSON.stringify(error)} to be retryable`);
    }
  }
});

Deno.test("surfaces deterministic client and payload failures", () => {
  const permanent = [
    new Error("Unsupported sync entity: mystery"),
    new Error("Book list item is missing list or book identity"),
    new Error(
      "The remote book identity changed, but this device has no complete book snapshot to reconcile it",
    ),
    new Error("The existing book could not be identified safely"),
    new Error(
      "The library book operation did not return a canonical book ID and record",
    ),
    {
      code: "PGRST116",
      message: "JSON object requested, multiple (or no) rows returned",
    },
    { status: 403, message: "Access denied" },
  ];

  for (const error of permanent) {
    if (isRetryableSyncError(error)) {
      throw new Error(`Expected ${JSON.stringify(error)} to require review`);
    }
  }
});
