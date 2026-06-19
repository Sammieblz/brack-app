import { invokeFunction } from "./client";
import type { ImportCommitResult, ImportPreview, ReadingBackupPayloadV1 } from "@/types";

export const exportReadingData = async () =>
  invokeFunction<{
    success: boolean;
    format: "brack-reading-backup";
    version: 1;
    exported_at: string;
    data: Omit<ReadingBackupPayloadV1, "manifest">;
  }>("export-reading-data", { body: {} });

export const previewReadingImportRemote = async (
  sourceFormat: ImportPreview["source_format"],
  payload: Omit<ReadingBackupPayloadV1, "manifest">,
  sourceHash?: string
) =>
  invokeFunction<ImportPreview & { success: boolean }>("preview-reading-import", {
    body: {
      source_format: sourceFormat,
      source_hash: sourceHash,
      payload,
    },
  });

export const commitReadingImportRemote = async (importId: string, batchSize = 100) =>
  invokeFunction<{
    success: boolean;
    complete: boolean;
    processed_items: number;
    total_items: number;
    result: ImportCommitResult;
  }>("commit-reading-import", {
    body: { import_id: importId, batch_size: batchSize },
  });
