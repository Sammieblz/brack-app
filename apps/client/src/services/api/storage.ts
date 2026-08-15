import { supabase } from "@/integrations/supabase/client";
import {
  isNormalizableUploadImage,
  normalizeUploadMedia,
} from "@/utils/normalizeUploadMedia";

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
  let uploadBody = file;
  let uploadOptions = options;

  if (file instanceof Blob && isNormalizableUploadImage(file)) {
    const normalized = await normalizeUploadMedia(file, {
      fileName: path.split("/").pop() || "upload",
      maxDimension: bucket === "avatars" ? 1024 : 2560,
      outputMimeType: "preserve",
    });
    uploadBody = normalized.body;
    uploadOptions = {
      ...options,
      contentType: normalized.mimeType,
    };
  }

  // Keep the caller-provided path stable for legacy/public bucket contracts.
  await uploadStorageFile(bucket, path, uploadBody, uploadOptions);
  return getStoragePublicUrl(bucket, path);
};
