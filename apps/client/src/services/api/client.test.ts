import { describe, expect, it } from "vitest";
import { getApiErrorStatus, getApiRetryAfterMs } from "./client";

describe("API error metadata", () => {
  it("treats absent and primitive errors as having no HTTP metadata", () => {
    expect(getApiErrorStatus(null)).toBeNull();
    expect(getApiErrorStatus(undefined)).toBeNull();
    expect(getApiErrorStatus("offline")).toBeNull();
    expect(getApiRetryAfterMs(null)).toBeNull();
  });

  it("reads status metadata from direct and response-shaped errors", () => {
    expect(getApiErrorStatus({ status: 429 })).toBe(429);
    expect(getApiErrorStatus({ context: { status: 503 } })).toBe(503);
  });
});
