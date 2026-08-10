interface BookUpdateResult {
  data: unknown;
  error: unknown;
}

interface BookUpdateSelection extends PromiseLike<BookUpdateResult> {
  maybeSingle(): PromiseLike<BookUpdateResult>;
}

interface BookUpdateQuery {
  eq(column: string, value: unknown): BookUpdateQuery;
  is(column: string, value: unknown): BookUpdateQuery;
  select(): BookUpdateSelection;
}

export interface BookSyncClient {
  from(table: string): {
    update(values: Record<string, unknown>): BookUpdateQuery;
  };
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

export const BOOK_SYNC_SNAPSHOT_KEY = "__sync_snapshot";

export interface BookSyncItem {
  client_entity_id: string;
  entity: string;
  operation: string;
  payload: Record<string, unknown>;
}

export const UNRESOLVED_CANONICAL_BOOK_ERROR =
  "The existing book could not be identified safely";
export const INCOMPLETE_CANONICAL_BOOK_ERROR =
  "The library book operation did not return a canonical book ID and record";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const omitKeys = (payload: Record<string, unknown>, keys: string[]) => {
  const next = { ...payload };
  for (const key of keys) delete next[key];
  return next;
};

const updateActiveBook = async (
  supabaseClient: BookSyncClient,
  userId: string,
  bookId: string,
  updates: Record<string, unknown>,
) => {
  const { data, error } = await supabaseClient
    .from("books")
    .update(updates)
    .eq("id", bookId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Record<string, unknown> | null;
};

const recoveryBookId = (value: unknown) => {
  const result = isRecord(value) ? value : null;
  return result && typeof result.book_id === "string" && result.book_id.trim()
    ? result.book_id
    : null;
};

const addLibraryBook = async (
  supabaseClient: BookSyncClient,
  userId: string,
  book: Record<string, unknown>,
) => {
  const { data, error } = await supabaseClient.rpc("add_library_book", {
    p_user_id: userId,
    p_book: book,
  });
  if (error) throw error;
  return data;
};

const isBookExistsResult = (value: unknown) =>
  isRecord(value) && value.code === "book_exists";

const addLibraryBookWithBoundedReplay = async (
  supabaseClient: BookSyncClient,
  userId: string,
  book: Record<string, unknown>,
  isComplete: (value: unknown) => boolean,
) => {
  const firstResult = await addLibraryBook(supabaseClient, userId, book);
  if (isComplete(firstResult) || !isBookExistsResult(firstResult)) {
    return firstResult;
  }

  return await addLibraryBook(
    supabaseClient,
    userId,
    omitKeys(book, ["id"]),
  );
};

const canonicalBookResult = (value: unknown) => {
  const result = isRecord(value) ? value : null;
  const bookId = recoveryBookId(value);
  const record = result && isRecord(result.book) ? result.book : null;
  if (
    !bookId ||
    !record ||
    typeof record.id !== "string" ||
    record.id !== bookId
  ) {
    return null;
  }

  return { bookId, record };
};

/**
 * Creates or restores a book only when the RPC returns one unambiguous
 * canonical identity. Legacy RPC versions can report `book_exists` without
 * the winner after a requested-UUID collision, so replay exactly once without
 * that stale UUID before surfacing a permanent reconciliation error.
 */
export const processBookCreateOrRestore = async (
  supabaseClient: BookSyncClient,
  userId: string,
  item: BookSyncItem,
) => {
  const result = await addLibraryBookWithBoundedReplay(
    supabaseClient,
    userId,
    {
      ...item.payload,
      id: item.payload.id || item.client_entity_id,
      user_id: userId,
    },
    (value) => canonicalBookResult(value) !== null,
  );
  const canonical = canonicalBookResult(result);
  if (canonical) {
    return {
      server_entity_id: canonical.bookId,
      record: canonical.record,
    };
  }

  if (isBookExistsResult(result)) {
    throw new Error(UNRESOLVED_CANONICAL_BOOK_ERROR);
  }
  throw new Error(INCOMPLETE_CANONICAL_BOOK_ERROR);
};

/**
 * Resolves a stale local identity through add_library_book's canonical ISBN or
 * title/author boundary. Older versions of that RPC can catch a uniqueness
 * race (or a globally colliding requested UUID) and return `book_exists`
 * without the matching `book_id`. A single collision-safe replay without the
 * client UUID lets the RPC re-read the winner or allocate a server UUID.
 */
const recoverBookId = async (
  supabaseClient: BookSyncClient,
  userId: string,
  recoveryBook: Record<string, unknown>,
) => {
  const result = await addLibraryBookWithBoundedReplay(
    supabaseClient,
    userId,
    recoveryBook,
    (value) => recoveryBookId(value) !== null,
  );
  const bookId = recoveryBookId(result);
  if (bookId) return bookId;

  const record = isRecord(result) ? result : null;
  if (record?.code === "book_exists") {
    throw new Error(UNRESOLVED_CANONICAL_BOOK_ERROR);
  }
  throw new Error(
    record && typeof record.message === "string"
      ? record.message
      : "The remote book could not be reconciled with this local change",
  );
};

/**
 * Applies a book patch and repairs stale local identities when an earlier
 * duplicate-create was reconciled to a different canonical server row.
 */
export const processBookUpdate = async (
  supabaseClient: BookSyncClient,
  userId: string,
  item: BookSyncItem,
) => {
  const updates = omitKeys(item.payload, [
    "id",
    "user_id",
    "created_at",
    "deleted_at",
    BOOK_SYNC_SNAPSHOT_KEY,
  ]);
  updates.updated_at = new Date().toISOString();

  const directRecord = await updateActiveBook(
    supabaseClient,
    userId,
    item.client_entity_id,
    updates,
  );
  if (directRecord) return directRecord;

  const embeddedSnapshot = item.payload[BOOK_SYNC_SNAPSHOT_KEY];
  const snapshot = isRecord(embeddedSnapshot) &&
      typeof embeddedSnapshot.title === "string" &&
      embeddedSnapshot.title.trim()
    ? embeddedSnapshot
    : typeof item.payload.title === "string" && item.payload.title.trim()
    ? item.payload
    : null;
  if (!snapshot) {
    throw new Error(
      "The remote book identity changed, but this device has no complete book snapshot to reconcile it",
    );
  }

  // add_library_book is the canonical identity boundary: it compares the
  // checksum-normalized ISBN first, then normalized title/author when no ISBN
  // exists. It also safely restores a matching soft-deleted row or recreates a
  // truly missing row from the complete local snapshot.
  const recoveryBook = {
    ...snapshot,
    ...omitKeys(item.payload, [BOOK_SYNC_SNAPSHOT_KEY]),
    id: item.client_entity_id,
    user_id: userId,
  };
  const recoveredId = await recoverBookId(
    supabaseClient,
    userId,
    recoveryBook,
  );

  const recoveredRecord = await updateActiveBook(
    supabaseClient,
    userId,
    recoveredId,
    updates,
  );
  if (!recoveredRecord) {
    throw new Error(
      "The remote book changed again while its identity was being reconciled",
    );
  }
  return recoveredRecord;
};

const aliasKey = (entity: string, entityId: string) => `${entity}:${entityId}`;

/** Rewrites identities only inside one ordered sync-push batch. */
export const applySyncAliases = <T extends BookSyncItem>(
  item: T,
  aliases: ReadonlyMap<string, string>,
): T => {
  const aliasedEntityId = aliases.get(
    aliasKey(item.entity, item.client_entity_id),
  );
  let payload = item.payload;
  const bookId = typeof payload.book_id === "string"
    ? aliases.get(aliasKey("books", payload.book_id))
    : null;
  const listId = typeof payload.list_id === "string"
    ? aliases.get(aliasKey("book_lists", payload.list_id))
    : null;

  if (bookId || listId) {
    payload = {
      ...payload,
      ...(bookId ? { book_id: bookId } : {}),
      ...(listId ? { list_id: listId } : {}),
    };
  }

  if (!aliasedEntityId && payload === item.payload) return item;
  return {
    ...item,
    client_entity_id: aliasedEntityId ?? item.client_entity_id,
    payload,
  };
};

export const rememberSyncAlias = (
  aliases: Map<string, string>,
  entity: string,
  clientEntityId: string,
  serverEntityId: string | undefined,
) => {
  if (serverEntityId && clientEntityId !== serverEntityId) {
    aliases.set(aliasKey(entity, clientEntityId), serverEntityId);
  }
};
