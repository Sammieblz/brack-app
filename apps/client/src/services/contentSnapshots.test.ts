import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentSnapshot } from "@/types";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  get: vi.fn(),
  upsert: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));
vi.mock("@/services/local", () => ({
  contentSnapshotsRepo: { get: mocks.get, upsert: mocks.upsert, remove: mocks.remove },
}));

import { withContentSnapshot } from "./contentSnapshots";

const snapshotId = "reader:conversations:home";
const savedData = [{ id: "private-conversation" }];
const snapshot: ContentSnapshot = {
  id: snapshotId,
  user_id: "reader",
  scope: "conversations",
  data: savedData,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  expires_at: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "reader" } } } });
  mocks.get.mockResolvedValue(snapshot);
  mocks.upsert.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);
});

describe("content snapshot access-denial safety", () => {
  it.each([401, 403])("does not return cached private data after HTTP %i", async (status) => {
    const error = Object.assign(new Error("Access denied"), { status });

    await expect(withContentSnapshot("conversations", "home", () => Promise.reject(error)))
      .rejects.toBe(error);

    expect(mocks.get).toHaveBeenCalledWith(snapshotId);
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(snapshotId);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it.each([401, 403])("recognizes an edge-function response carrying HTTP %i", async (status) => {
    const error = Object.assign(new Error("Function denied"), { context: { status } });

    await expect(withContentSnapshot("conversations", "home", () => Promise.reject(error)))
      .rejects.toBe(error);

    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(snapshotId);
  });

  it("removes only the denied viewer/resource snapshot and prevents its later offline fallback", async () => {
    const otherResource = { ...snapshot, id: "reader:feed:posts:15", scope: "feed" as const };
    const otherViewer = { ...snapshot, id: "other:conversations:home", user_id: "other" };
    const cache = new Map([snapshot, otherResource, otherViewer].map((entry) => [entry.id, entry]));
    mocks.get.mockImplementation(async (id: string) => cache.get(id) ?? null);
    mocks.remove.mockImplementation(async (id: string) => { cache.delete(id); });
    const denial = Object.assign(new Error("Access denied"), { status: 403 });

    await expect(withContentSnapshot("conversations", "home", () => Promise.reject(denial)))
      .rejects.toBe(denial);

    const offline = new TypeError("Failed to fetch");
    await expect(withContentSnapshot("conversations", "home", () => Promise.reject(offline)))
      .rejects.toBe(offline);
    expect([...cache.keys()]).toEqual([otherResource.id, otherViewer.id]);
  });

  it("keeps the original denial when scoped cache cleanup fails", async () => {
    mocks.remove.mockRejectedValue(new Error("Storage unavailable"));
    const error = Object.assign(new Error("Access denied"), { status: 403 });

    await expect(withContentSnapshot("conversations", "home", () => Promise.reject(error)))
      .rejects.toBe(error);
  });

  it.each([
    new TypeError("Failed to fetch"),
    Object.assign(new Error("Temporarily unavailable"), { status: 503 }),
  ])("preserves the cached snapshot for a transient failure: %s", async (error) => {
    await expect(withContentSnapshot("conversations", "home", () => Promise.reject(error)))
      .resolves.toEqual(savedData);

    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("does not treat an ambiguous endpoint 404 as a confirmed access denial", async () => {
    const error = Object.assign(new Error("Function not found"), { status: 404 });

    await expect(withContentSnapshot("conversations", "home", () => Promise.reject(error)))
      .resolves.toEqual(savedData);

    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("retains a successfully loaded empty snapshot during a network failure", async () => {
    mocks.get.mockResolvedValue({ ...snapshot, data: [] });

    await expect(withContentSnapshot("conversations", "home", () => Promise.reject(new TypeError("Failed to fetch"))))
      .resolves.toEqual([]);
  });

  it("returns and caches a successful fresh read", async () => {
    const freshData = [{ id: "new-conversation" }];

    await expect(withContentSnapshot("conversations", "home", async () => freshData))
      .resolves.toBe(freshData);

    expect(mocks.upsert).toHaveBeenCalledExactlyOnceWith("reader", expect.objectContaining({
      id: snapshotId,
      user_id: "reader",
      scope: "conversations",
      data: freshData,
      created_at: snapshot.created_at,
    }));
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("does not read another viewer's snapshots without a local session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    const error = Object.assign(new Error("Unauthenticated"), { status: 401 });

    await expect(withContentSnapshot("conversations", "home", () => Promise.reject(error)))
      .rejects.toBe(error);

    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
