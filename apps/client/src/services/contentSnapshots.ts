import { supabase } from "@/integrations/supabase/client";
import { contentSnapshotsRepo } from "@/services/local";
import type { ContentSnapshot } from "@/types";

type SnapshotScope = ContentSnapshot["scope"];

const getLocalUserId = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id ?? null;
};

export const withContentSnapshot = async <T>(
  scope: SnapshotScope,
  key: string,
  loader: () => Promise<T>,
): Promise<T> => {
  const userId = await getLocalUserId();
  if (!userId) return loader();

  const snapshotId = `${userId}:${scope}:${key}`;
  const cached = await contentSnapshotsRepo.get(snapshotId);

  try {
    const data = await loader();
    const timestamp = new Date().toISOString();
    await contentSnapshotsRepo.upsert(userId, {
      id: snapshotId,
      user_id: userId,
      scope,
      data,
      created_at: cached?.created_at ?? timestamp,
      updated_at: timestamp,
      expires_at: null,
    });
    return data;
  } catch (error) {
    if (cached) return cached.data as T;
    throw error;
  }
};
