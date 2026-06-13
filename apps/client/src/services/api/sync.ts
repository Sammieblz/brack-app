import { invokeFunction } from "./client";
import type { SyncPullResponse, SyncPushRequest, SyncPushResponse } from "@/services/sync/types";

export const pullSyncChanges = async (cursor?: string | null): Promise<SyncPullResponse> => {
  return invokeFunction<SyncPullResponse>("sync-pull", {
    body: { cursor: cursor ?? null },
  });
};

export const pushSyncMutations = async (
  request: SyncPushRequest
): Promise<SyncPushResponse> => {
  return invokeFunction<SyncPushResponse>("sync-push", {
    body: request,
  });
};
