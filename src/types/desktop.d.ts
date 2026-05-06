import type { LocalRecord, OutboxItem, SyncState } from "@/services/sync/types";
import type { LocalTableName } from "@/services/local/driver";

export type BrackRuntimePlatform = "web" | "ios" | "android" | "desktop";

export interface BrackDesktopPlatformInfo {
  runtime: "desktop";
  os: NodeJS.Platform;
  arch: NodeJS.Architecture;
  appVersion: string;
}

export type BrackDesktopLocalDbRequest =
  | { operation: "upsertRecord"; table: LocalTableName; record: LocalRecord }
  | { operation: "upsertRecords"; table: LocalTableName; records: LocalRecord[] }
  | { operation: "getRecord"; table: LocalTableName; id: string }
  | {
      operation: "listRecords";
      table: LocalTableName;
      userId: string;
      options?: { includeDeleted?: boolean };
    }
  | { operation: "removeRecord"; table: LocalTableName; id: string }
  | { operation: "enqueueOutbox"; item: OutboxItem }
  | { operation: "listOutbox"; userId: string; statuses?: OutboxItem["status"][] }
  | { operation: "updateOutbox"; id: string; updates: Partial<OutboxItem> }
  | { operation: "deleteOutbox"; id: string }
  | { operation: "getOutboxCounts"; userId: string }
  | { operation: "getSyncState"; userId: string; scope: string }
  | { operation: "setSyncState"; state: SyncState };

export interface BrackDesktopBridge {
  platform: {
    getInfo(): Promise<BrackDesktopPlatformInfo>;
  };
  localDb: {
    invoke<T = unknown>(request: BrackDesktopLocalDbRequest): Promise<T>;
  };
  auth: {
    openExternal(url: string): Promise<void>;
    onCallback(handler: (url: string) => void): () => void;
  };
  deepLinks: {
    onOpen(handler: (url: string) => void): () => void;
  };
  app: {
    onForeground(handler: () => void): () => void;
  };
}

declare global {
  interface Window {
    brackDesktop?: BrackDesktopBridge;
  }
}
