import {
  applySyncAliases,
  BOOK_SYNC_SNAPSHOT_KEY,
  type BookSyncClient,
  INCOMPLETE_CANONICAL_BOOK_ERROR,
  processBookCreateOrRestore,
  processBookUpdate,
  rememberSyncAlias,
  UNRESOLVED_CANONICAL_BOOK_ERROR,
} from "./bookSync.ts";

const assert: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) throw new Error(message);
};

const makeBookClient = (options: {
  updateResults: Array<Record<string, unknown> | null>;
  recoveryResult?: Record<string, unknown>;
  recoveryResults?: Array<Record<string, unknown>>;
}) => {
  const updatedIds: string[] = [];
  const updatePayloads: Record<string, unknown>[] = [];
  const updateFilters: Array<Record<string, unknown>> = [];
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

  const client = {
    from(table: string) {
      assert(table === "books", `Unexpected table ${table}`);
      return {
        update(payload: Record<string, unknown>) {
          updatePayloads.push(payload);
          const filters: Record<string, unknown> = {};
          updateFilters.push(filters);
          const builder = {
            eq(column: string, value: unknown) {
              filters[column] = value;
              if (column === "id") updatedIds.push(String(value));
              return builder;
            },
            is() {
              return builder;
            },
            select() {
              return builder;
            },
            async maybeSingle() {
              return {
                data: options.updateResults.shift() ?? null,
                error: null,
              };
            },
          };
          return builder;
        },
      };
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      return {
        data: options.recoveryResults?.shift() ?? options.recoveryResult ??
          null,
        error: null,
      };
    },
  };

  return {
    client: client as unknown as BookSyncClient,
    updatedIds,
    updatePayloads,
    updateFilters,
    rpcCalls,
  };
};

Deno.test("book create and restore recover one canonical record without the stale UUID", async () => {
  for (const operation of ["create", "restore"]) {
    const canonical = {
      id: `book-canonical-${operation}`,
      user_id: "user-1",
      title: "Supernova",
      author: "Marissa Meyer",
      isbn: "9781250078391",
    };
    const mock = makeBookClient({
      updateResults: [],
      recoveryResults: [
        {
          success: false,
          code: "book_exists",
          message: "Book already exists in your library",
        },
        {
          success: false,
          code: "book_exists",
          book_id: canonical.id,
          book: canonical,
        },
      ],
    });

    const result = await processBookCreateOrRestore(mock.client, "user-1", {
      client_entity_id: `book-stale-${operation}`,
      entity: "books",
      operation,
      payload: {
        id: `book-stale-${operation}`,
        title: "Supernova",
        author: "Marissa Meyer",
        isbn: "9781250078391",
      },
    });

    assert(
      result.server_entity_id === canonical.id,
      `Expected ${operation} to return the canonical ID`,
    );
    assert(
      result.record === canonical,
      `Expected ${operation} to return the canonical record`,
    );
    assert(
      mock.rpcCalls.length === 2,
      `Expected ${operation} to replay exactly once`,
    );
    const firstBook = mock.rpcCalls[0].args.p_book as Record<string, unknown>;
    const replayBook = mock.rpcCalls[1].args.p_book as Record<string, unknown>;
    assert(
      firstBook.id === `book-stale-${operation}`,
      `Expected ${operation} to try the client UUID first`,
    );
    assert(
      !("id" in replayBook),
      `Expected ${operation} replay to omit the stale UUID`,
    );
    assert(
      replayBook.user_id === "user-1",
      `Expected ${operation} replay to remain owner-scoped`,
    );
  }
});

Deno.test("book create and restore stop after one unresolved canonical replay", async () => {
  for (const operation of ["create", "restore"]) {
    const mock = makeBookClient({
      updateResults: [],
      recoveryResults: [
        {
          success: false,
          code: "book_exists",
          message: "Book already exists in your library",
        },
        {
          success: false,
          code: "book_exists",
          book_id: "book-canonical",
          message: "Book already exists in your library",
        },
      ],
    });
    let message = "";

    try {
      await processBookCreateOrRestore(mock.client, "user-1", {
        client_entity_id: `book-stale-${operation}`,
        entity: "books",
        operation,
        payload: {
          title: "Supernova",
          author: "Marissa Meyer",
          isbn: "9781250078391",
        },
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    assert(
      mock.rpcCalls.length === 2,
      `${operation} reconciliation must not loop indefinitely`,
    );
    assert(
      message === UNRESOLVED_CANONICAL_BOOK_ERROR,
      `Expected deterministic unresolved ${operation} error`,
    );
  }
});

Deno.test("book create and restore reject incomplete or mismatched canonical results", async () => {
  const incompleteResults = [
    { success: true, book_id: "book-canonical" },
    { success: true, book: { id: "book-canonical" } },
    {
      success: true,
      book_id: "book-canonical",
      book: { id: "book-other" },
    },
  ];

  for (const operation of ["create", "restore"]) {
    for (const recoveryResult of incompleteResults) {
      const mock = makeBookClient({
        updateResults: [],
        recoveryResult,
      });
      let message = "";

      try {
        await processBookCreateOrRestore(mock.client, "user-1", {
          client_entity_id: `book-stale-${operation}`,
          entity: "books",
          operation,
          payload: { title: "Supernova" },
        });
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      assert(
        mock.rpcCalls.length === 1,
        `Malformed successful ${operation} result must not be retried`,
      );
      assert(
        message === INCOMPLETE_CANONICAL_BOOK_ERROR,
        `Expected deterministic incomplete ${operation} error`,
      );
    }
  }
});

Deno.test("book update uses the exact active owner-scoped ID before reconciliation", async () => {
  const exact = {
    id: "book-exact",
    user_id: "user-1",
    title: "Supernova",
    status: "reading",
  };
  const mock = makeBookClient({ updateResults: [exact] });

  const result = await processBookUpdate(mock.client, "user-1", {
    client_entity_id: "book-exact",
    entity: "books",
    operation: "update",
    payload: { status: "reading" },
  });

  assert(result.id === "book-exact", "Expected the exact book record");
  assert(
    mock.updatedIds.join(",") === "book-exact",
    "Expected one exact-ID update",
  );
  assert(
    mock.rpcCalls.length === 0,
    "Exact matches must not invoke canonical recovery",
  );
  assert(
    mock.updateFilters[0].user_id === "user-1",
    "The exact update must be scoped to its owner",
  );
});

Deno.test("old-client full book payload reconciles a stale ID through canonical ISBN identity", async () => {
  const canonical = {
    id: "book-canonical",
    user_id: "user-1",
    title: "Supernova",
    author: "Marissa Meyer",
    isbn: "9781250078391",
    status: "reading",
  };
  const mock = makeBookClient({
    updateResults: [null, canonical],
    recoveryResult: {
      success: false,
      code: "book_exists",
      book_id: "book-canonical",
      book: { ...canonical, status: "to_read" },
    },
  });

  const result = await processBookUpdate(mock.client, "user-1", {
    client_entity_id: "book-stale-local",
    entity: "books",
    operation: "update",
    payload: {
      title: "Supernova",
      author: "Marissa Meyer",
      isbn: "9781250078391",
      status: "reading",
    },
  });

  assert(
    result.id === "book-canonical",
    "Expected the canonical record to be returned",
  );
  assert(
    mock.updatedIds.join(",") === "book-stale-local,book-canonical",
    "Expected exact-ID first and canonical-ID second",
  );
  assert(
    mock.rpcCalls.length === 1,
    "Expected one canonical identity recovery call",
  );
  const recoveryBook = mock.rpcCalls[0].args.p_book as Record<string, unknown>;
  assert(
    recoveryBook.user_id === "user-1",
    "Recovery must remain owner-scoped",
  );
  assert(
    mock.updateFilters.every((filters) => filters.user_id === "user-1"),
    "Both stale and canonical updates must be scoped to the owner",
  );
  assert(
    recoveryBook.isbn === "9781250078391",
    "Expected the screenshot ISBN identity",
  );
  assert(
    !(BOOK_SYNC_SNAPSHOT_KEY in mock.updatePayloads[1]),
    "No sync metadata may reach books",
  );
});

Deno.test("a sync snapshot augments a partial future update without being persisted", async () => {
  const canonical = {
    id: "book-canonical",
    user_id: "user-1",
    title: "Supernova",
    author: "Marissa Meyer",
    isbn: "9781250078391",
    current_page: 24,
  };
  const mock = makeBookClient({
    updateResults: [null, canonical],
    recoveryResult: {
      success: false,
      code: "book_exists",
      book_id: "book-canonical",
      book: canonical,
    },
  });

  await processBookUpdate(mock.client, "user-1", {
    client_entity_id: "book-stale-local",
    entity: "books",
    operation: "update",
    payload: {
      current_page: 24,
      [BOOK_SYNC_SNAPSHOT_KEY]: {
        ...canonical,
        id: "book-stale-local",
        current_page: 0,
      },
    },
  });

  const recoveryBook = mock.rpcCalls[0].args.p_book as Record<string, unknown>;
  assert(
    recoveryBook.title === "Supernova",
    "Expected snapshot identity to augment the patch",
  );
  assert(
    recoveryBook.current_page === 24,
    "Expected the pending patch to win over the snapshot",
  );
  assert(
    !(BOOK_SYNC_SNAPSHOT_KEY in mock.updatePayloads[1]),
    "Sync-only snapshots must never be written to books",
  );
});

Deno.test("book update replays an ambiguous uniqueness conflict without the stale client UUID", async () => {
  const canonical = {
    id: "book-canonical",
    user_id: "user-1",
    title: "Supernova",
    author: "Marissa Meyer",
    isbn: "9781250078391",
    status: "reading",
  };
  const mock = makeBookClient({
    updateResults: [null, canonical],
    recoveryResults: [
      {
        success: false,
        code: "book_exists",
        message: "Book already exists in your library",
      },
      {
        success: false,
        code: "book_exists",
        book_id: "book-canonical",
        book: canonical,
      },
    ],
  });

  const result = await processBookUpdate(mock.client, "user-1", {
    client_entity_id: "book-stale-local",
    entity: "books",
    operation: "update",
    payload: {
      title: "Supernova",
      author: "Marissa Meyer",
      isbn: "9781250078391",
      status: "reading",
    },
  });

  assert(result.id === "book-canonical", "Expected the canonical record");
  assert(mock.rpcCalls.length === 2, "Expected one collision-safe replay");
  const firstBook = mock.rpcCalls[0].args.p_book as Record<string, unknown>;
  const replayBook = mock.rpcCalls[1].args.p_book as Record<string, unknown>;
  assert(
    firstBook.id === "book-stale-local",
    "The first recovery should preserve the client UUID",
  );
  assert(
    !("id" in replayBook),
    "The replay must let the server resolve or allocate the canonical UUID",
  );
  assert(
    replayBook.user_id === "user-1",
    "The replay must remain scoped to the authenticated owner",
  );
});

Deno.test("book update stops after one unresolved collision-safe replay", async () => {
  const mock = makeBookClient({
    updateResults: [null],
    recoveryResults: [
      {
        success: false,
        code: "book_exists",
        message: "Book already exists in your library",
      },
      {
        success: false,
        code: "book_exists",
        message: "Book already exists in your library",
      },
    ],
  });
  let message = "";

  try {
    await processBookUpdate(mock.client, "user-1", {
      client_entity_id: "book-stale-local",
      entity: "books",
      operation: "update",
      payload: {
        title: "Supernova",
        author: "Marissa Meyer",
        isbn: "9781250078391",
      },
    });
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  assert(mock.rpcCalls.length === 2, "Recovery must not loop indefinitely");
  assert(
    message.includes("could not be identified safely"),
    "Expected a deterministic reconciliation error",
  );
});

Deno.test("book update rejects a missing target without sufficient recovery identity", async () => {
  const mock = makeBookClient({ updateResults: [null] });
  let message = "";

  try {
    await processBookUpdate(mock.client, "user-1", {
      client_entity_id: "book-missing",
      entity: "books",
      operation: "update",
      payload: { current_page: 12 },
    });
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  assert(
    message.includes("no complete book snapshot"),
    "Expected a deterministic identity error",
  );
  assert(
    mock.rpcCalls.length === 0,
    "Insufficient identity must not create a partial book",
  );
});

Deno.test("ordered sync batches carry canonical aliases into later mutations", () => {
  const aliases = new Map<string, string>();
  rememberSyncAlias(aliases, "books", "book-local", "book-canonical");

  const bookUpdate = applySyncAliases(
    {
      client_entity_id: "book-local",
      entity: "books",
      operation: "update",
      payload: { status: "reading" },
    },
    aliases,
  );
  const progress = applySyncAliases(
    {
      client_entity_id: "progress-local",
      entity: "progress_logs",
      operation: "create",
      payload: { book_id: "book-local", page_number: 12 },
    },
    aliases,
  );

  assert(
    bookUpdate.client_entity_id === "book-canonical",
    "Expected the later update to use the alias",
  );
  assert(
    progress.payload.book_id === "book-canonical",
    "Expected dependent book IDs to use the alias",
  );
});
