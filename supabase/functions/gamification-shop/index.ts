import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

interface PurchaseBody {
  itemCode?: unknown;
  quantity?: unknown;
  idempotencyKey?: unknown;
}

const ITEM_CODE_PATTERN = /^[a-z0-9_]{1,64}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  try {
    const client = createServiceClient();
    const auth = await getAuthenticatedUser(req, client, origin);
    if ("response" in auth) return auth.response;

    const limited = await enforceRateLimit(req, client, {
      name: req.method === "GET" ? "gamification-shop-read" : "gamification-shop-purchase",
      identifier: auth.user.id,
      limit: req.method === "GET" ? 60 : 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    if (req.method === "GET") {
      const { data, error } = await client.rpc("get_gamification_shop", {
        p_user_id: auth.user.id,
      });
      if (error) throw error;
      return jsonResponse(
        data ?? { account: { user_id: auth.user.id, gold_leaves: 0 }, items: [] },
        200,
        origin,
      );
    }

    const body = await parseJsonBody<PurchaseBody>(req);
    const itemCode = typeof body.itemCode === "string" ? body.itemCode.trim() : "";
    const idempotencyKey =
      typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    const quantity = body.quantity === undefined ? 1 : Number(body.quantity);

    if (!ITEM_CODE_PATTERN.test(itemCode)) {
      return jsonResponse({ error: "Invalid shop item" }, 400, origin);
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
      return jsonResponse({ error: "Quantity must be between 1 and 10" }, 400, origin);
    }
    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      return jsonResponse({ error: "Invalid idempotency key" }, 400, origin);
    }

    const { data, error } = await client.rpc("purchase_gamification_item", {
      p_user_id: auth.user.id,
      p_item_code: itemCode,
      p_quantity: quantity,
      p_idempotency_key: idempotencyKey,
    });
    if (error) {
      const message = String(error.message || "").toLowerCase();
      if (message.includes("insufficient gold leaves")) {
        return jsonResponse({ error: "Not enough Gold Leaves" }, 409, origin);
      }
      if (message.includes("inventory limit")) {
        return jsonResponse({ error: "Inventory limit reached" }, 409, origin);
      }
      if (message.includes("shop item")) {
        return jsonResponse({ error: "Shop item is unavailable" }, 404, origin);
      }
      throw error;
    }

    return jsonResponse(data ?? { success: true }, 200, origin);
  } catch (error) {
    console.error("gamification-shop failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to update Journey shop" },
      500,
      origin,
    );
  }
});
