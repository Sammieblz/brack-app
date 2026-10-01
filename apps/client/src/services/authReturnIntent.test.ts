import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAuthReturnIntent, completeAuthReturnIntent, getPostAuthDestination, getReaderSignInPath, rememberAuthReturnIntent } from "./authReturnIntent";

describe("reader destination through authentication", () => {
  beforeEach(() => { clearAuthReturnIntent(); window.sessionStorage.clear(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); clearAuthReturnIntent(); });
  it.each(["/lists", "/book-lists", "/goals-management"])("keeps %s until that screen arrives", path => {
    rememberAuthReturnIntent(path);
    expect(getPostAuthDestination()).toBe(path);
    expect(getPostAuthDestination()).toBe(path); // The setup guard also reads it.
    completeAuthReturnIntent("/onboarding");
    expect(getPostAuthDestination()).toBe(path);
    expect(getReaderSignInPath(path)).toBe(`/auth?mode=signin&returnTo=${encodeURIComponent(path)}`);
    completeAuthReturnIntent(path);
    expect(getPostAuthDestination()).toBe("/dashboard");
  });
  it.each(["https://evil.invalid", "//evil.invalid", "/lists?next=elsewhere", "/lists#content", "/auth", " /lists", "/%6cists", null, {}])("rejects invalid input %j and clears a previous destination", path => {
    rememberAuthReturnIntent("/lists");
    rememberAuthReturnIntent(path);
    expect(getPostAuthDestination()).toBe("/dashboard");
  });
  it("expires after fifteen minutes without refreshing its lifetime when read", () => {
    vi.useFakeTimers();
    rememberAuthReturnIntent("/lists");
    vi.advanceTimersByTime(14 * 60_000);
    expect(getPostAuthDestination()).toBe("/lists");
    vi.advanceTimersByTime(60_000);
    expect(getPostAuthDestination()).toBe("/dashboard");
  });
  it("rejects future, malformed and corrupt persisted data", () => {
    for (const stored of ['{', '{}', JSON.stringify({ path: '/lists', createdAt: Date.now() + 60_000 }), JSON.stringify({ path: '//evil.invalid', createdAt: Date.now() })]) {
      rememberAuthReturnIntent("/lists");
      window.sessionStorage.setItem("brack:auth-return:v1", stored);
      expect(getPostAuthDestination()).toBe("/dashboard");
    }
  });
  it("keeps an in-memory return and cancellation when storage is disabled", () => {
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => { throw new Error("Storage denied"); });
    rememberAuthReturnIntent("/goals-management");
    expect(getPostAuthDestination()).toBe("/goals-management");
    clearAuthReturnIntent();
    expect(getPostAuthDestination()).toBe("/dashboard");
  });
});
