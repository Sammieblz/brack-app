import { describe, expect, it } from "vitest";
import {
  bookListItemsRepo,
  bookListsRepo,
  createLocalId,
  syncRepo,
} from "./repositories";
import type { BookList, BookListItem } from "@/types";

describe("durable local repositories", () => {
  it("stores local list writes and queues them for synchronization", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const list: BookList = {
      id: crypto.randomUUID(),
      user_id: userId,
      name: "Offline list",
      description: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      is_public: false,
      order_version: 0,
    };
    await bookListsRepo.upsertLocal(userId, list, "create");
    expect(await bookListsRepo.get(list.id)).toMatchObject({ name: "Offline list" });
    expect((await syncRepo.listPending(userId))[0]).toMatchObject({
      entity: "book_lists",
      operation: "create",
      client_entity_id: list.id,
    });
  });

  it("does not auto-retry failed outbox items until the user retries them", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    await syncRepo.enqueueMutation(userId, "reading_sessions", createLocalId(), "create", {
      book_id: crypto.randomUUID(),
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      duration: 99999,
    });

    const [item] = await syncRepo.listPending(userId);
    await syncRepo.markFailed(item, "Reading sessions cannot exceed 12 hours");

    expect(await syncRepo.listPending(userId)).toEqual([]);
    expect(await syncRepo.listFailed(userId)).toHaveLength(1);
  });

  it("does not overwrite a pending local list with a pulled remote snapshot", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const list: BookList = {
      id: crypto.randomUUID(),
      user_id: userId,
      name: "Local pending name",
      description: null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-02T00:00:00.000Z",
      deleted_at: null,
      is_public: false,
      order_version: 0,
    };
    await bookListsRepo.upsertLocal(userId, list, "update");

    const [resolved] = await bookListsRepo.upsertRemoteManyPreservingLocal(userId, [
      {
        ...list,
        name: "Older remote name",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    ]);

    expect(resolved.name).toBe("Local pending name");
    expect((await bookListsRepo.get(list.id))?.name).toBe("Local pending name");
  });

  it("queues an update patch instead of a stale full-entity snapshot", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const list: BookList = {
      id: crypto.randomUUID(),
      user_id: userId,
      name: "Original",
      description: "Keep remote-compatible fields",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      deleted_at: null,
      is_public: false,
      order_version: 7,
    };
    await bookListsRepo.upsertRemote(userId, list);
    await bookListsRepo.upsertLocal(
      userId,
      {
        ...list,
        name: "Renamed",
        updated_at: "2026-07-02T00:00:00.000Z",
      },
      "update",
    );

    const [mutation] = await syncRepo.listPending(userId);
    expect(mutation.payload).toEqual({
      name: "Renamed",
      updated_at: "2026-07-02T00:00:00.000Z",
    });
  });

  it("commits reordered list state and its outbox mutation together", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const timestamp = "2026-07-03T00:00:00.000Z";
    const list: BookList = {
      id: crypto.randomUUID(),
      user_id: userId,
      name: "Favorites",
      description: null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: timestamp,
      deleted_at: null,
      is_public: false,
      order_version: 2,
    };
    const item: BookListItem = {
      id: crypto.randomUUID(),
      user_id: userId,
      list_id: list.id,
      book_id: crypto.randomUUID(),
      position: 0,
      added_at: "2026-07-01T00:00:00.000Z",
      updated_at: timestamp,
      deleted_at: null,
    };

    await bookListsRepo.commitReorder(userId, list, [item], {
      ordered_book_ids: [item.book_id],
      expected_version: 1,
      order_version: 2,
      updated_at: timestamp,
    });

    expect((await bookListsRepo.listRecords(userId))[0].status).toBe("pending");
    expect((await bookListItemsRepo.listRecords(userId))[0].status).toBe("pending");
    expect((await syncRepo.listPending(userId))[0]).toMatchObject({
      entity: "book_lists",
      operation: "reorder",
      client_entity_id: list.id,
    });
  });
});
