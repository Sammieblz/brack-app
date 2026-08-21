import { describe, expect, it } from "vitest";
import {
  claimPendingShopPurchase,
  clearPendingShopPurchase,
} from "./shopPurchase";

describe("pending Journey shop purchases", () => {
  it("reuses the same durable idempotency key until success is confirmed", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };

    const first = claimPendingShopPurchase(
      "reader-1",
      "streak_freeze",
      "purchase-key-1",
      storage,
    );
    const retry = claimPendingShopPurchase(
      "reader-1",
      "streak_freeze",
      "purchase-key-2",
      storage,
    );

    expect(first).toMatchObject({ idempotencyKey: "purchase-key-1", reused: false });
    expect(retry).toMatchObject({ idempotencyKey: "purchase-key-1", reused: true });

    clearPendingShopPurchase("reader-1", "streak_freeze", "purchase-key-1", storage);
    expect(claimPendingShopPurchase(
      "reader-1",
      "streak_freeze",
      "purchase-key-3",
      storage,
    )).toMatchObject({ idempotencyKey: "purchase-key-3", reused: false });
  });

  it("does not clear a newer pending request from another tab", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    claimPendingShopPurchase("reader-1", "streak_freeze", "purchase-key-1", storage);

    const storageKey = [...values.keys()][0];
    values.set(storageKey, JSON.stringify({
      version: 1,
      userId: "reader-1",
      itemCode: "streak_freeze",
      idempotencyKey: "purchase-key-2",
    }));
    clearPendingShopPurchase("reader-1", "streak_freeze", "purchase-key-1", storage);

    expect(claimPendingShopPurchase(
      "reader-1",
      "streak_freeze",
      "purchase-key-3",
      storage,
    ).idempotencyKey).toBe("purchase-key-2");
  });
});
