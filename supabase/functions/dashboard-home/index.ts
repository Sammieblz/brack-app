import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { composeDashboardHomeV2, parseOptionalBoolean } from "./contract.ts";

interface DashboardHomeBody {
  recent_limit?: unknown;
  include_journey?: unknown;
  force_refresh?: unknown;
}

type JsonValue =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

type RpcResponse = {
  data: JsonValue | undefined;
  error: unknown;
};

type TimedRpcResponse = {
  response: RpcResponse;
  duration_ms: number;
};

class InvalidDashboardRequestError extends Error {}

const withNoStore = (response: Response): Response => {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
};

const runTimedRpc = async (
  request: PromiseLike<RpcResponse>,
): Promise<TimedRpcResponse> => {
  const startedAt = performance.now();
  try {
    return {
      response: await request,
      duration_ms: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      response: {
        data: null,
        error: error ?? new Error("Dashboard RPC request failed"),
      },
      duration_ms: Math.round(performance.now() - startedAt),
    };
  }
};

const hasRpcError = (result: RpcResponse): boolean => result.error != null;

type DashboardHomeHandlerDependencies = {
  createServiceClient: typeof createServiceClient;
  getAuthenticatedUser: typeof getAuthenticatedUser;
  enforceRateLimit: typeof enforceRateLimit;
  jsonResponse: typeof jsonResponse;
  optionsResponse: typeof optionsResponse;
};

const defaultDependencies: DashboardHomeHandlerDependencies = {
  createServiceClient,
  getAuthenticatedUser,
  enforceRateLimit,
  jsonResponse,
  optionsResponse,
};

export const createDashboardHomeHandler = (
  overrides: Partial<DashboardHomeHandlerDependencies> = {},
) => {
  const dependencies = { ...defaultDependencies, ...overrides };
  const respond = (
    body: Record<string, unknown> | unknown[],
    status: number,
    origin: string | null,
  ) => withNoStore(dependencies.jsonResponse(body, status, origin));

  return async (req: Request): Promise<Response> => {
    const requestStartedAt = performance.now();
    const origin = req.headers.get("origin");

    if (req.method === "OPTIONS") {
      return withNoStore(dependencies.optionsResponse(origin));
    }
    if (req.method !== "GET" && req.method !== "POST") {
      return respond({ error: "Method not allowed" }, 405, origin);
    }

    try {
      const supabaseClient = dependencies.createServiceClient();
      const authResult = await dependencies.getAuthenticatedUser(
        req,
        supabaseClient,
        origin,
      );
      if ("response" in authResult) return withNoStore(authResult.response);

      const url = new URL(req.url);
      const body = req.method === "GET"
        ? {}
        : await parseJsonBody<DashboardHomeBody>(req);
      const requestedLimit = Number.parseInt(
        url.searchParams.get("recent_limit") ||
          String(body.recent_limit ?? "") ||
          "10",
        10,
      );
      const recentLimit = Number.isFinite(requestedLimit)
        ? Math.min(Math.max(requestedLimit, 1), 30)
        : 10;

      let includeJourney: boolean;
      let forceRefresh: boolean;
      try {
        const includeJourneyValue = url.searchParams.has("include_journey")
          ? url.searchParams.get("include_journey")
          : body.include_journey;
        const forceRefreshValue = url.searchParams.has("force_refresh")
          ? url.searchParams.get("force_refresh")
          : body.force_refresh;
        includeJourney = parseOptionalBoolean(
          includeJourneyValue,
          "include_journey",
        ) ?? false;
        forceRefresh = parseOptionalBoolean(
          forceRefreshValue,
          "force_refresh",
        ) ?? false;
      } catch (error) {
        throw new InvalidDashboardRequestError(
          error instanceof Error ? error.message : "Invalid dashboard request",
        );
      }

      const limited = await dependencies.enforceRateLimit(req, supabaseClient, {
        name: includeJourney ? "dashboard-home-journey" : "dashboard-home",
        identifier: authResult.user.id,
        limit: includeJourney ? 60 : 120,
        windowMs: 60_000,
      });
      if (limited) return withNoStore(limited);

      if (forceRefresh) {
        const forceLimited = await dependencies.enforceRateLimit(
          req,
          supabaseClient,
          {
            name: "dashboard-home-force-refresh",
            identifier: authResult.user.id,
            limit: 12,
            windowMs: 60_000,
          },
        );
        if (forceLimited) return withNoStore(forceLimited);
      }

      const dashboardRpc = runTimedRpc(
        supabaseClient.rpc("get_dashboard_home_snapshot", {
          p_user_id: authResult.user.id,
          p_recent_limit: recentLimit,
          p_max_age_seconds: forceRefresh ? 0 : 300,
        }) as unknown as PromiseLike<RpcResponse>,
      );

      // The default remains the original one-RPC response with no additive keys,
      // preserving installed clients that do not request the Journey contract.
      if (!includeJourney) {
        const dashboardResult = await dashboardRpc;
        const { data, error } = dashboardResult.response;
        if (error) throw error;
        console.info("dashboard-home completed", {
          contract: "legacy",
          force_refresh: forceRefresh,
          duration_ms: Math.round(performance.now() - requestStartedAt),
          sections: {
            dashboard: {
              status: "ok",
              duration_ms: dashboardResult.duration_ms,
            },
            journey: { status: "not_requested" },
            inventory: { status: "not_requested" },
          },
        });
        return respond((data ?? {}) as Record<string, unknown>, 200, origin);
      }

      const gamificationRpc = runTimedRpc(
        supabaseClient.rpc("get_gamification_home", {
          p_user_id: authResult.user.id,
        }) as unknown as PromiseLike<RpcResponse>,
      );
      const shopRpc = runTimedRpc(
        supabaseClient.rpc("get_gamification_shop", {
          p_user_id: authResult.user.id,
        }) as unknown as PromiseLike<RpcResponse>,
      );

      const [dashboardTimed, gamificationTimed, shopTimed] = await Promise.all([
        dashboardRpc,
        gamificationRpc,
        shopRpc,
      ]);

      const dashboardResult = dashboardTimed.response;
      if (hasRpcError(dashboardResult)) throw dashboardResult.error;

      const gamificationResult = gamificationTimed.response;
      const shopResult = shopTimed.response;
      const composition = composeDashboardHomeV2(
        dashboardResult,
        gamificationResult,
        shopResult,
        new Date().toISOString(),
      );

      if (composition.inventory_error != null) {
        console.warn("dashboard-home Journey inventory unavailable", {
          userId: authResult.user.id,
          error: composition.inventory_error,
        });
      }
      if (composition.journey_error != null) {
        console.warn("dashboard-home Journey summary unavailable", {
          userId: authResult.user.id,
          error: composition.journey_error,
        });
      }

      console.info("dashboard-home completed", {
        contract: "v2",
        force_refresh: forceRefresh,
        duration_ms: Math.round(performance.now() - requestStartedAt),
        sections: {
          dashboard: { status: "ok", duration_ms: dashboardTimed.duration_ms },
          journey: {
            status: composition.response.meta.journey_status,
            duration_ms: gamificationTimed.duration_ms,
          },
          inventory: {
            status: composition.response.meta.inventory_status,
            duration_ms: shopTimed.duration_ms,
          },
        },
      });

      return respond(composition.response, 200, origin);
    } catch (error) {
      console.error("dashboard-home failed", {
        error,
        duration_ms: Math.round(performance.now() - requestStartedAt),
      });
      if (error instanceof InvalidDashboardRequestError) {
        return respond({ error: error.message }, 400, origin);
      }
      return respond(
        { error: "Failed to load dashboard home" },
        500,
        origin,
      );
    }
  };
};

if (import.meta.main) {
  Deno.serve(createDashboardHomeHandler());
}
