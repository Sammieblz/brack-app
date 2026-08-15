interface PendingPurchaseStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

interface PendingPurchaseRecord {
  version: 1;
  userId: string;
  itemCode: string;
  idempotencyKey: string;
}

export interface PendingPurchaseClaim {
  idempotencyKey: string;
  durable: boolean;
  reused: boolean;
}

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

const pendingPurchaseKey = (userId: string, itemCode: string) =>
  `brack:shop-purchase-pending:v1:${userId}:${encodeURIComponent(itemCode)}`;

const resolveStorage = (storage: PendingPurchaseStorage | null | undefined) => {
  if (storage !== undefined) return storage;
  return typeof window !== "undefined" ? window.localStorage : null;
};

const isPendingPurchaseRecord = (
  value: unknown,
  userId: string,
  itemCode: string,
): value is PendingPurchaseRecord => {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PendingPurchaseRecord>;
  return record.version === 1
    && record.userId === userId
    && record.itemCode === itemCode
    && typeof record.idempotencyKey === "string"
    && IDEMPOTENCY_KEY_PATTERN.test(record.idempotencyKey);
};

export const claimPendingShopPurchase = (
  userId: string,
  itemCode: string,
  proposedKey: string,
  storage?: PendingPurchaseStorage | null,
): PendingPurchaseClaim => {
  try {
    const durableStorage = resolveStorage(storage);
    if (!durableStorage) {
      return { idempotencyKey: proposedKey, durable: false, reused: false };
    }

    const key = pendingPurchaseKey(userId, itemCode);
    const raw = durableStorage.getItem(key);
    if (raw) {
      const existing = JSON.parse(raw) as unknown;
      if (isPendingPurchaseRecord(existing, userId, itemCode)) {
        return {
          idempotencyKey: existing.idempotencyKey,
          durable: true,
          reused: true,
        };
      }
    }

    const record: PendingPurchaseRecord = {
      version: 1,
      userId,
      itemCode,
      idempotencyKey: proposedKey,
    };
    durableStorage.setItem(key, JSON.stringify(record));
    return { idempotencyKey: proposedKey, durable: true, reused: false };
  } catch {
    return { idempotencyKey: proposedKey, durable: false, reused: false };
  }
};

export const clearPendingShopPurchase = (
  userId: string,
  itemCode: string,
  confirmedKey: string,
  storage?: PendingPurchaseStorage | null,
) => {
  try {
    const durableStorage = resolveStorage(storage);
    if (!durableStorage) return;
    const key = pendingPurchaseKey(userId, itemCode);
    const raw = durableStorage.getItem(key);
    if (!raw) return;
    const existing = JSON.parse(raw) as unknown;
    if (isPendingPurchaseRecord(existing, userId, itemCode)
      && existing.idempotencyKey === confirmedKey) {
      durableStorage.removeItem(key);
    }
  } catch {
    // The in-memory key still protects retries for this mounted session.
  }
};
