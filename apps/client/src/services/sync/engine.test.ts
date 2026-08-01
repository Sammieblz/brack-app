import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncRepo } from "@/services/local";

const { pullSyncChangesMock, pushSyncMutationsMock } = vi.hoisted(() => ({
  pullSyncChangesMock: vi.fn(),
  pushSyncMutationsMock: vi.fn(),
}));

vi.mock("@/services/api/sync", () => ({
  pullSyncChanges: pullSyncChangesMock,
  pushSyncMutations: pushSyncMutationsMock,
}));

vi.mock("@/services/connectivity", () => ({
  isConnectivityAvailable: () => true,
}));

vi.mock("@/services/telemetry", () => ({
  trackCoreEvent: vi.fn(),
}));

import { ReadingCoreSyncEngine } from "./engine";

const emptyPullResponse = {
  records: {
    books: [],
    reading_sessions: [],
    progress_logs: [],
    journal_entries: [],
    goals: [],
    profile_preferences: [],
    book_lists: [],
    book_list_items: [],
  },
  cursor: "2026-07-01T00:00:00.000Z",
  has_more: false,
};

const acceptItems = (items: Array<Record<string, unknown>>) => ({
  accepted: items.map((item) => ({
    id: item.id,
    client_mutation_id: item.client_mutation_id,
    entity: item.entity,
    client_entity_id: item.client_entity_id,
  })),
  failed: [],
  cursor: "2026-07-01T00:00:00.000Z",
});

describe("reading core sync single-flight behavior", () => {
  beforeEach(() => {
    pullSyncChangesMock.mockReset();
    pushSyncMutationsMock.mockReset();
    pullSyncChangesMock.mockResolvedValue(emptyPullResponse);
  });

  it("runs another pass when a mutation arrives during an active push", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    let releaseFirstPush: (() => void) | null = null;

    pushSyncMutationsMock
      .mockImplementationOnce(
        ({ items }: { items: Array<Record<string, unknown>> }) =>
          new Promise((resolve) => {
            releaseFirstPush = () => resolve(acceptItems(items));
          }),
      )
      .mockImplementation(
        ({ items }: { items: Array<Record<string, unknown>> }) =>
          Promise.resolve(acceptItems(items)),
      );

    await syncRepo.enqueueMutation(userId, "goals", "goal-1", "create", {
      id: "goal-1",
    });
    const engine = new ReadingCoreSyncEngine();
    const firstSync = engine.syncUser(userId);
    await vi.waitFor(() => expect(pushSyncMutationsMock).toHaveBeenCalledTimes(1));

    await syncRepo.enqueueMutation(userId, "goals", "goal-2", "create", {
      id: "goal-2",
    });
    const secondSync = engine.syncUser(userId);
    releaseFirstPush?.();

    await Promise.all([firstSync, secondSync]);

    expect(pushSyncMutationsMock).toHaveBeenCalledTimes(2);
    expect(pushSyncMutationsMock.mock.calls[1][0].items).toEqual([
      expect.objectContaining({ client_entity_id: "goal-2" }),
    ]);
    expect(await syncRepo.listPending(userId)).toEqual([]);
  });
});
