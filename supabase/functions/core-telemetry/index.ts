import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import {
  cleanTelemetryMetadata,
  isAllowedTelemetryEvent,
  requiresAuthenticatedTelemetry,
  TelemetryValidationError,
} from "./validation.ts";

interface TelemetryRequest {
  event_name?: unknown;
  platform?: unknown;
  app_version?: unknown;
  metadata?: unknown;
}

type CoreTelemetryHandlerDependencies = {
  createServiceClient: typeof createServiceClient;
  getAuthenticatedUser: typeof getAuthenticatedUser;
  enforceRateLimit: typeof enforceRateLimit;
  jsonResponse: typeof jsonResponse;
  optionsResponse: typeof optionsResponse;
};

const defaultDependencies: CoreTelemetryHandlerDependencies = {
  createServiceClient,
  getAuthenticatedUser,
  enforceRateLimit,
  jsonResponse,
  optionsResponse,
};

export const createCoreTelemetryHandler = (
  overrides: Partial<CoreTelemetryHandlerDependencies> = {},
) => {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get("origin");
    if (req.method === "OPTIONS") return dependencies.optionsResponse(origin);
    if (req.method !== "POST") {
      return dependencies.jsonResponse(
        { error: "Method not allowed" },
        405,
        origin,
      );
    }

    try {
      const serviceClient = dependencies.createServiceClient();
      const body = await parseJsonBody<TelemetryRequest>(req);
      const eventName = typeof body.event_name === "string"
        ? body.event_name.trim()
        : "";
      if (!isAllowedTelemetryEvent(eventName)) {
        return dependencies.jsonResponse(
          { error: "Unsupported telemetry event" },
          400,
          origin,
        );
      }

      let userId: string | null = null;
      if (requiresAuthenticatedTelemetry(eventName)) {
        const auth = await dependencies.getAuthenticatedUser(
          req,
          serviceClient,
          origin,
        );
        if ("response" in auth) return auth.response;
        userId = auth.user.id;
      } else {
        const authHeader = req.headers.get("Authorization");
        if (authHeader?.startsWith("Bearer ")) {
          const token = authHeader.slice(7).trim();
          const {
            data: { user },
          } = await serviceClient.auth.getUser(token);
          userId = user?.id ?? null;
        }
      }

      const limited = await dependencies.enforceRateLimit(req, serviceClient, {
        name: requiresAuthenticatedTelemetry(eventName)
          ? "core-telemetry-journey"
          : "core-telemetry",
        identifier: userId ?? undefined,
        limit: 120,
        windowMs: 60_000,
      });
      if (limited) return limited;

      let metadata: Record<string, unknown>;
      try {
        metadata = cleanTelemetryMetadata(eventName, body.metadata);
      } catch (error) {
        if (error instanceof TelemetryValidationError) {
          return dependencies.jsonResponse(
            { error: error.message },
            400,
            origin,
          );
        }
        throw error;
      }

      const platform = typeof body.platform === "string"
        ? body.platform.trim().slice(0, 32)
        : "web";
      const appVersion = typeof body.app_version === "string"
        ? body.app_version.trim().slice(0, 64)
        : null;

      const { error } = await serviceClient.from("core_telemetry_events")
        .insert({
          user_id: userId,
          event_name: eventName,
          platform: platform || "web",
          app_version: appVersion || null,
          metadata,
        });

      if (error) throw error;
      return dependencies.jsonResponse({ accepted: true }, 202, origin);
    } catch (error) {
      console.error("core-telemetry failed", error);
      return dependencies.jsonResponse(
        { error: "Failed to record telemetry" },
        500,
        origin,
      );
    }
  };
};

if (import.meta.main) {
  Deno.serve(createCoreTelemetryHandler());
}
