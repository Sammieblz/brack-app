import {
  createServiceClient,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import {
  DistributedRateLimitUnavailableError,
  enforceRateLimit,
} from "../_shared/rateLimit.ts";

interface AuthEmailAvailabilityBody {
  email?: unknown;
}

type AuthEmailAvailabilityHandlerDependencies = {
  createServiceClient: typeof createServiceClient;
  enforceRateLimit: typeof enforceRateLimit;
  jsonResponse: typeof jsonResponse;
  optionsResponse: typeof optionsResponse;
};

const defaultDependencies: AuthEmailAvailabilityHandlerDependencies = {
  createServiceClient,
  enforceRateLimit,
  jsonResponse,
  optionsResponse,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

const withNoStore = (response: Response): Response => {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
};

const normalizeEmail = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (
    !normalized ||
    normalized.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(normalized)
  ) {
    return null;
  }

  return normalized;
};

export const createAuthEmailAvailabilityHandler = (
  overrides: Partial<AuthEmailAvailabilityHandlerDependencies> = {},
) => {
  const dependencies = { ...defaultDependencies, ...overrides };
  const respond = (
    body: Record<string, unknown>,
    status: number,
    origin: string | null,
  ) => withNoStore(dependencies.jsonResponse(body, status, origin));

  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get("origin");

    if (req.method === "OPTIONS") {
      return withNoStore(dependencies.optionsResponse(origin));
    }
    if (req.method !== "POST") {
      const response = respond({ error: "Method not allowed" }, 405, origin);
      response.headers.set("Allow", "POST, OPTIONS");
      return response;
    }

    try {
      const serviceClient = dependencies.createServiceClient();

      const minuteLimited = await dependencies.enforceRateLimit(
        req,
        serviceClient,
        {
          name: "auth-email-availability-minute",
          limit: 5,
          windowMs: 60_000,
          failClosed: true,
        },
      );
      if (minuteLimited) return withNoStore(minuteLimited);

      const hourLimited = await dependencies.enforceRateLimit(
        req,
        serviceClient,
        {
          name: "auth-email-availability-hour",
          limit: 30,
          windowMs: 3_600_000,
          failClosed: true,
        },
      );
      if (hourLimited) return withNoStore(hourLimited);

      const body = await parseJsonBody<AuthEmailAvailabilityBody>(req);
      const email = normalizeEmail(body.email);
      if (!email) {
        return respond(
          { error: "Enter a valid email address", code: "invalid_email" },
          400,
          origin,
        );
      }

      const { data, error } = await serviceClient.rpc("auth_email_exists", {
        p_email: email,
      });
      if (error) throw error;
      if (typeof data !== "boolean") {
        throw new Error("Invalid auth email availability response");
      }

      return respond({ exists: data }, 200, origin);
    } catch (error) {
      if (error instanceof DistributedRateLimitUnavailableError) {
        const response = respond(
          {
            error:
              "Request verification is temporarily unavailable. Please try again later.",
          },
          503,
          origin,
        );
        response.headers.set(
          "Retry-After",
          error.retryAfterSeconds.toString(),
        );
        return response;
      }

      console.error("auth-email-availability failed", {
        error_type: error instanceof Error ? error.name : "unknown",
      });
      return respond(
        { error: "Unable to verify email availability" },
        500,
        origin,
      );
    }
  };
};

if (import.meta.main) {
  Deno.serve(createAuthEmailAvailabilityHandler());
}
