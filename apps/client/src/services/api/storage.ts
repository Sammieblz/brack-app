import { supabase } from "@/integrations/supabase/client";

export interface StorageUploadOptions {
  cacheControl?: string;
  contentType?: string;
  upsert?: boolean;
}

export const uploadStorageFile = async (
  bucket: string,
  path: string,
  file: Blob | File | ArrayBuffer,
  options?: StorageUploadOptions
): Promise<void> => {
  const { error } = await supabase.storage.from(bucket).upload(path, file, options);
  if (error) throw error;
};

export const removeStorageFiles = async (
  bucket: string,
  paths: string[]
): Promise<void> => {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw error;
};

export const getStoragePublicUrl = (bucket: string, path: string): string => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

export const uploadPublicStorageFile = async (
  bucket: string,
  path: string,
  file: Blob | File | ArrayBuffer,
  options?: StorageUploadOptions
): Promise<string> => {
  await uploadStorageFile(bucket, path, file, options);
  return getStoragePublicUrl(bucket, path);
};
