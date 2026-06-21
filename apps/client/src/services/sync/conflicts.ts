import type { Book } from "@/types";
import type { LocalRecord } from "./types";

const timestamp = (value?: string | null) => {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

export const resolveBookSyncConflict = (
  local: LocalRecord<Book>,
  remote: Book,
): Book => {
  const localUpdatedAt = timestamp(local.data.updated_at || local.updated_at);
  const remoteUpdatedAt = timestamp(remote.updated_at || remote.created_at);

  if (local.data.deleted_at && localUpdatedAt >= remoteUpdatedAt) {
    return local.data;
  }

  if (remote.deleted_at && remoteUpdatedAt >= localUpdatedAt) {
    return remote;
  }

  if (
    local.data.status === "completed" &&
    remote.status !== "completed" &&
    localUpdatedAt >= remoteUpdatedAt
  ) {
    return local.data;
  }

  if (
    remote.status === "completed" &&
    local.data.status !== "completed" &&
    remoteUpdatedAt >= localUpdatedAt
  ) {
    return remote;
  }

  return localUpdatedAt > remoteUpdatedAt ? local.data : remote;
};
