import { describe, expect, it } from "vitest";
import { bookListsRepo, syncRepo } from "./repositories";
import type { BookList } from "@/types";

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
});
