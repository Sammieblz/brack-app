import { describe, expect, it, vi } from "vitest";
import {
  APP_HISTORY_MAX_ENTRIES,
  APP_HISTORY_STORAGE_KEY,
  createAppHistoryTracker,
  type AppHistoryAction,
  type AppHistoryObservation,
} from "./appHistory";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
  };
}

function position(key: string, index: number | null, action: AppHistoryAction = "POP", scope: string | null = "account-a"): AppHistoryObservation {
  return { key, index, action, scope, boundary: false };
}

describe("verified app history ancestry", () => {
  it.each([0, 1, 99])("does not treat an arbitrary direct index %i as app ancestry", index => {
    const tracker = createAppHistoryTracker(memoryStorage());
    expect(tracker.observe(position("direct", index))).toBe(false);
    expect(tracker.observe(position("replacement", index, "REPLACE"))).toBe(false);
  });

  it("allows only an adjacent observed push and checks the live entry at activation", () => {
    const tracker = createAppHistoryTracker(memoryStorage());
    tracker.observe(position("entry", 5));
    expect(tracker.observe(position("detail", 6, "PUSH"))).toBe(true);
    expect(tracker.canGoBack(position("detail", 6))).toBe(true);
    expect(tracker.canGoBack(position("stale-key", 6))).toBe(false);
    expect(tracker.canGoBack(position("detail", 7))).toBe(false);
    expect(tracker.canGoBack(position("detail", 6, "POP", "account-b"))).toBe(false);
  });

  it("starts a new branch when a push skips unobserved entries", () => {
    const tracker = createAppHistoryTracker(memoryStorage());
    tracker.observe(position("entry", 0));
    tracker.observe(position("detail", 1, "PUSH"));
    expect(tracker.observe(position("gap", 3, "PUSH"))).toBe(false);
    expect(tracker.observe(position("after-gap", 4, "PUSH"))).toBe(true);
    expect(tracker.observe(position("detail", 1))).toBe(false);
  });

  it("preserves known ancestry through browser Back and Forward", () => {
    const tracker = createAppHistoryTracker(memoryStorage());
    tracker.observe(position("root", 0));
    tracker.observe(position("list", 1, "PUSH"));
    tracker.observe(position("book", 2, "PUSH"));
    expect(tracker.observe(position("list", 1))).toBe(true);
    expect(tracker.observe(position("root", 0))).toBe(false);
    expect(tracker.observe(position("list", 1))).toBe(true);
    expect(tracker.observe(position("book", 2))).toBe(true);
  });

  it("replaces an entry without losing its predecessor or the retained forward branch", () => {
    const tracker = createAppHistoryTracker(memoryStorage());
    tracker.observe(position("root", 0));
    tracker.observe(position("old-list", 1, "PUSH"));
    tracker.observe(position("book", 2, "PUSH"));
    tracker.observe(position("old-list", 1));
    expect(tracker.observe(position("new-list", 1, "REPLACE"))).toBe(true);
    expect(tracker.canGoBack(position("old-list", 1))).toBe(false);
    expect(tracker.observe(position("book", 2))).toBe(true);
    expect(tracker.observe(position("new-list", 1))).toBe(true);
  });

  it("truncates the forward branch after a new push from an earlier entry", () => {
    const tracker = createAppHistoryTracker(memoryStorage());
    tracker.observe(position("root", 0));
    tracker.observe(position("list", 1, "PUSH"));
    tracker.observe(position("discarded-book", 2, "PUSH"));
    tracker.observe(position("list", 1));
    expect(tracker.observe(position("new-book", 2, "PUSH"))).toBe(true);
    expect(tracker.observe(position("discarded-book", 2))).toBe(false);
    expect(tracker.observe(position("list", 1))).toBe(false);
  });

  it("does not infer a predecessor after an unknown POP or a reused key", () => {
    const tracker = createAppHistoryTracker(memoryStorage());
    tracker.observe(position("root", 0));
    tracker.observe(position("list", 1, "PUSH"));
    expect(tracker.observe(position("unknown", 2))).toBe(false);
    expect(tracker.observe(position("unknown", 3, "PUSH"))).toBe(false);
    expect(tracker.observe(position("next", 4, "PUSH"))).toBe(true);
  });

  it("restores a verified entry on reload only after observing its matching key and index", () => {
    const storage = memoryStorage();
    const first = createAppHistoryTracker(storage);
    first.observe(position("root", 7));
    first.observe(position("book", 8, "PUSH"));
    const reloaded = createAppHistoryTracker(storage);
    expect(reloaded.canGoBack(position("book", 8))).toBe(false);
    expect(reloaded.observe(position("book", 8))).toBe(true);
    const direct = createAppHistoryTracker(storage);
    expect(direct.observe(position("unrelated", 8))).toBe(false);
    expect(direct.canGoBack(position("book", 8))).toBe(false);
  });

  it("restores an observed branch when the coordinator remounts during PUSH", () => {
    const storage = memoryStorage();
    const tracker = createAppHistoryTracker(storage);
    tracker.observe(position("root", 0));
    tracker.observe(position("book", 1, "PUSH"));
    expect(createAppHistoryTracker(storage).observe(position("book", 1, "PUSH"))).toBe(true);
  });

  it.each(["account-b", null])("clears ancestry across scope change to %s and back", nextScope => {
    const storage = memoryStorage();
    const tracker = createAppHistoryTracker(storage);
    tracker.observe(position("root", 0));
    tracker.observe(position("book", 1, "PUSH"));
    expect(tracker.observe(position("book", 1, "POP", nextScope))).toBe(false);
    expect(tracker.observe(position("book", 1))).toBe(false);
    expect(createAppHistoryTracker(storage).observe(position("book", 1))).toBe(false);
  });

  it("makes an auth boundary forget all entries and never records the auth entry", () => {
    const storage = memoryStorage();
    storage.setItem("unrelated-preference", "keep");
    const tracker = createAppHistoryTracker(storage);
    tracker.observe(position("root", 0));
    tracker.observe(position("book", 1, "PUSH"));
    expect(tracker.observe({ ...position("auth-callback", 2, "REPLACE"), boundary: true })).toBe(false);
    expect(storage.getItem(APP_HISTORY_STORAGE_KEY)).toBeNull();
    expect(storage.getItem("unrelated-preference")).toBe("keep");
    expect(tracker.observe(position("landing", 3, "PUSH"))).toBe(false);
    expect(tracker.observe(position("new-book", 4, "PUSH"))).toBe(true);
  });

  it("is idempotent for duplicate observations and replacement rerenders", () => {
    const tracker = createAppHistoryTracker(memoryStorage());
    tracker.observe(position("root", 0));
    expect(tracker.observe(position("book", 1, "PUSH"))).toBe(true);
    expect(tracker.observe(position("book", 1, "PUSH"))).toBe(true);
    expect(tracker.observe(position("edited-book", 1, "REPLACE"))).toBe(true);
    expect(tracker.observe(position("edited-book", 1, "REPLACE"))).toBe(true);
    expect(tracker.observe(position("root", 0))).toBe(false);
  });

  it.each([null, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])("drops ancestry for invalid index %s", index => {
    const tracker = createAppHistoryTracker(memoryStorage());
    tracker.observe(position("root", 0));
    tracker.observe(position("book", 1, "PUSH"));
    expect(tracker.observe(position("book", index))).toBe(false);
    expect(tracker.canGoBack(position("book", 1))).toBe(false);
  });

  it.each([
    "not-json",
    JSON.stringify({ version: 2, scope: "account-a", entries: [] }),
    JSON.stringify({ version: 1, scope: "account-a", entries: [{ key: "book", index: 1, predecessor: "missing" }] }),
    JSON.stringify({ version: 1, scope: "account-a", entries: [{ key: "root", index: 0, predecessor: null }, { key: "book", index: 2, predecessor: "root" }] }),
    JSON.stringify({ version: 1, scope: "account-a", entries: [{ key: "same", index: 0, predecessor: null }, { key: "same", index: 1, predecessor: "same" }] }),
  ])("rejects malformed or inconsistent stored branches (%#)", raw => {
    const storage = memoryStorage();
    storage.setItem(APP_HISTORY_STORAGE_KEY, raw);
    const tracker = createAppHistoryTracker(storage);
    expect(storage.getItem(APP_HISTORY_STORAGE_KEY)).toBeNull();
    expect(tracker.observe(position("book", 1))).toBe(false);
  });

  it("continues in memory when storage reads, writes, and removals are blocked", () => {
    const denied = () => { throw new Error("Storage denied"); };
    const tracker = createAppHistoryTracker({ getItem: denied, setItem: denied, removeItem: denied });
    expect(tracker.observe(position("root", 0))).toBe(false);
    expect(tracker.observe(position("book", 1, "PUSH"))).toBe(true);
    expect(() => tracker.reset()).not.toThrow();
    expect(tracker.canGoBack(position("book", 1))).toBe(false);
  });

  it("removes stale persisted ancestry after a failed write without touching other keys", () => {
    const storage = memoryStorage();
    storage.setItem("unrelated", "keep");
    const tracker = createAppHistoryTracker(storage);
    tracker.observe(position("root", 0));
    storage.setItem.mockImplementationOnce(() => { throw new Error("Quota"); });
    expect(tracker.observe(position("book", 1, "PUSH"))).toBe(true);
    expect(storage.getItem(APP_HISTORY_STORAGE_KEY)).toBeNull();
    expect(storage.getItem("unrelated")).toBe("keep");
    expect(createAppHistoryTracker(storage).observe(position("book", 1))).toBe(false);
  });

  it("bounds persisted entries and stores only scope and minimal predecessor metadata", () => {
    const storage = memoryStorage();
    const tracker = createAppHistoryTracker(storage);
    tracker.observe(position("entry-0", 0));
    for (let index = 1; index <= APP_HISTORY_MAX_ENTRIES; index++) {
      expect(tracker.observe(position(`entry-${index}`, index, "PUSH"))).toBe(true);
    }
    const saved = JSON.parse(storage.getItem(APP_HISTORY_STORAGE_KEY)!);
    expect(Object.keys(saved).sort()).toEqual(["entries", "scope", "version"]);
    expect(saved.entries).toHaveLength(APP_HISTORY_MAX_ENTRIES);
    expect(saved.entries[0]).toEqual({ key: "entry-1", index: 1, predecessor: null });
    for (const entry of saved.entries) expect(Object.keys(entry).sort()).toEqual(["index", "key", "predecessor"]);
    expect(createAppHistoryTracker(storage).observe(position(`entry-${APP_HISTORY_MAX_ENTRIES}`, APP_HISTORY_MAX_ENTRIES))).toBe(true);
    expect(tracker.observe(position("entry-1", 1))).toBe(false);
    expect(tracker.observe(position("entry-2", 2))).toBe(true);
  });
});
