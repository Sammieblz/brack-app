import {
  createServiceClient,
  jsonResponse,
  optionsResponse,
} from "../_shared/appEndpoint.ts";
import {
  DistributedRateLimitUnavailableError,
  enforceRateLimit,
} from "../_shared/rateLimit.ts";

const SUPPORT_ADDRESS = "support@brack-app.com";
const TURNSTILE_ACTION = "support_contact";
const MAX_BODY_BYTES = 24_000;
const MAX_SUBJECT_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 5_000;
const MAX_EMAIL_LENGTH = 254;
const PROVIDER_TIMEOUT_MS = 8_000;
const PROCESSING_RETRY_SECONDS = 90;

const CATEGORY_LABELS = {
  account: "Account & sign-in",
  bug: "Something is not working",
  billing: "Billing",
  feedback: "Feedback or feature idea",
  privacy: "Privacy & safety",
  other: "Something else",
} as const;

type SupportCategory = keyof typeof CATEGORY_LABELS;
type JsonRecord = Record<string, unknown>;

type SupportDependencies = {
  createServiceClient: typeof createServiceClient;
  enforceRateLimit: typeof enforceRateLimit;
  fetch: typeof fetch;
  jsonResponse: typeof jsonResponse;
  optionsResponse: typeof optionsResponse;
  env: (name: string) => string | undefined;
  sleep: (milliseconds: number) => Promise<void>;
};

const defaultDependencies: SupportDependencies = {
  createServiceClient,
  enforceRateLimit,
  fetch,
  jsonResponse,
  optionsResponse,
  env: (name) => Deno.env.get(name),
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
};

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_PLATFORM_PATTERN = /^(web|pwa|ios|android|desktop)$/;

const hasControlCharacters = (value: string, allowWhitespace = false) =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    if (allowWhitespace && (code === 9 || code === 10 || code === 13)) return false;
    return code <= 31 || code === 127;
  });

const withNoStore = (response: Response) => {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
};

const normalizeEmail = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) return null;
  if (hasControlCharacters(email)) return null;
  return email;
};

const normalizeSingleLine = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || hasControlCharacters(normalized)) {
    return null;
  }
  return normalized;
};

const normalizeMessage = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (normalized.length < 10 || normalized.length > MAX_MESSAGE_LENGTH) return null;
  if (hasControlCharacters(normalized, true)) return null;
  return normalized;
};

const getClientIp = (req: Request): string => {
  for (const header of ["cf-connecting-ip", "x-real-ip", "x-forwarded-for"]) {
    const value = req.headers.get(header)?.split(",")[0]?.trim();
    if (value) return value.slice(0, 64);
  }
  return "unknown";
};

const digest = async (value: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const readJsonBody = async (req: Request): Promise<JsonRecord | null> => {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return null;
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const isAllowedOrigin = (origin: string | null, env: SupportDependencies["env"]) => {
  if (!origin) return true;
  const allowed = (env("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowed.includes(origin)) return true;
  if (env("ENVIRONMENT") === "development") {
    try {
      const hostname = new URL(origin).hostname;
      return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    } catch {
      return false;
    }
  }
  return false;
};

const verifyTurnstile = async ({
  token,
  remoteIp,
  requestId,
  dependencies,
}: {
  token: string;
  remoteIp: string;
  requestId: string;
  dependencies: SupportDependencies;
}) => {
  const secret = dependencies.env("TURNSTILE_SECRET_KEY");
  if (!secret) throw new Error("turnstile_not_configured");

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  form.set("idempotency_key", requestId);
  if (remoteIp !== "unknown") form.set("remoteip", remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await dependencies.fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form, signal: controller.signal },
    );
    if (!response.ok) return false;
    const result = await response.json() as JsonRecord;
    if (result.success !== true || result.action !== TURNSTILE_ACTION) return false;
    const allowedHostnames = (dependencies.env("TURNSTILE_ALLOWED_HOSTNAMES") ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    return allowedHostnames.length > 0
      && typeof result.hostname === "string"
      && allowedHostnames.includes(result.hostname.toLowerCase());
  } finally {
    clearTimeout(timeout);
  }
};

const getDestination = (env: SupportDependencies["env"]) => {
  const mode = env("SUPPORT_DELIVERY_MODE");
  if (mode === "production") return SUPPORT_ADDRESS;
  if (mode === "staging" || mode === "test") {
    const sink = normalizeEmail(env("SUPPORT_STAGING_SINK_EMAIL"));
    if (!sink || sink === SUPPORT_ADDRESS) throw new Error("invalid_staging_sink");
    return sink;
  }
  throw new Error("invalid_delivery_mode");
};

const sendWithBrevo = async ({
  requestId,
  category,
  subject,
  message,
  replyTo,
  diagnostics,
  dependencies,
}: {
  requestId: string;
  category: SupportCategory;
  subject: string;
  message: string;
  replyTo: string;
  diagnostics: string[];
  dependencies: SupportDependencies;
}) => {
  const apiKey = dependencies.env("BREVO_API_KEY");
  const sender = normalizeEmail(dependencies.env("SUPPORT_FROM_EMAIL"));
  if (!apiKey || !sender) throw new Error("provider_not_configured");
  const destination = getDestination(dependencies.env);
  const textContent = [
    message,
    "",
    "---",
    `Category: ${CATEGORY_LABELS[category]}`,
    `Request ID: ${requestId}`,
    ...diagnostics,
  ].join("\n");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    try {
      const response = await dependencies.fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          "Idempotency-Key": requestId,
        },
        body: JSON.stringify({
          sender: { email: sender, name: "Brack Support" },
          to: [{ email: destination, name: "Brack Support" }],
          replyTo: { email: replyTo },
          subject: `[Brack ${CATEGORY_LABELS[category]}] ${subject}`,
          textContent,
          tags: ["support-contact", `support-${category}`],
        }),
      });
      if (response.status === 201) {
        const result = await response.json() as JsonRecord;
        if (typeof result.messageId === "string" && result.messageId.length > 0) {
          return result.messageId.slice(0, 255);
        }
      }
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
        await dependencies.sleep(250);
        continue;
      }
      throw new Error(`provider_http_${response.status}`);
    } catch (error) {
      if (attempt === 0 && (error instanceof DOMException && error.name === "AbortError" || error instanceof TypeError)) {
        await dependencies.sleep(250);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("provider_unavailable");
};

export const createSupportContactHandler = (
  overrides: Partial<SupportDependencies> = {},
) => {
  const dependencies = { ...defaultDependencies, ...overrides };
  const respond = (body: JsonRecord, status: number, origin: string | null) =>
    withNoStore(dependencies.jsonResponse(body, status, origin));

  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get("origin");
    if (req.method === "OPTIONS") return withNoStore(dependencies.optionsResponse(origin));
    if (req.method !== "POST") {
      const response = respond({ error: "Method not allowed" }, 405, origin);
      response.headers.set("Allow", "POST, OPTIONS");
      return response;
    }
    if (!isAllowedOrigin(origin, dependencies.env)) {
      return respond({ error: "Origin not allowed" }, 403, origin);
    }

    let requestId: string | null = null;
    let actorFingerprint: string | null = null;
    let payloadDigest: string | null = null;
    let serviceClient: ReturnType<typeof createServiceClient> | null = null;

    try {
      const body = await readJsonBody(req);
      if (!body) return respond({ error: "Invalid or oversized request", code: "invalid_body" }, 400, origin);

      requestId = typeof body.request_id === "string" && UUID_PATTERN.test(body.request_id)
        ? body.request_id.toLowerCase()
        : null;
      const category = typeof body.category === "string" && body.category in CATEGORY_LABELS
        ? body.category as SupportCategory
        : null;
      const subject = normalizeSingleLine(body.subject, MAX_SUBJECT_LENGTH);
      const message = normalizeMessage(body.message);
      if (!requestId || !category || !subject || !message || typeof body.include_diagnostics !== "boolean") {
        return respond({ error: "Check the category, subject, and message", code: "invalid_fields" }, 400, origin);
      }

      serviceClient = dependencies.createServiceClient();
      const authHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
      const authResult = authHeader ? await serviceClient.auth.getUser(authHeader) : null;
      const user = authResult && !authResult.error ? authResult.data.user : null;
      const replyTo = user?.email ? normalizeEmail(user.email) : normalizeEmail(body.reply_email);
      if (!replyTo) return respond({ error: "Enter a valid reply email", code: "invalid_email" }, 400, origin);

      const clientIp = getClientIp(req);
      for (const options of [
        { name: "support-contact-ip-hour", identifier: clientIp, limit: 5, windowMs: 3_600_000 },
        { name: "support-contact-ip-day", identifier: clientIp, limit: 15, windowMs: 86_400_000 },
        ...(user ? [{ name: "support-contact-account-day", identifier: user.id, limit: 10, windowMs: 86_400_000 }] : []),
      ]) {
        const limited = await dependencies.enforceRateLimit(req, serviceClient, { ...options, failClosed: true });
        if (limited) return withNoStore(limited);
      }

      if (!user) {
        const token = typeof body.turnstile_token === "string" && body.turnstile_token.length <= 2_048
          ? body.turnstile_token
          : "";
        if (!token || !await verifyTurnstile({ token, remoteIp: clientIp, requestId, dependencies })) {
          return respond({ error: "Complete the security check and try again", code: "turnstile_failed" }, 403, origin);
        }
      }

      const diagnostics: string[] = [];
      if (body.include_diagnostics === true) {
        const rawDiagnostics = body.diagnostics && typeof body.diagnostics === "object"
          ? body.diagnostics as JsonRecord
          : {};
        const appVersion = normalizeSingleLine(rawDiagnostics.app_version, 64);
        const platform = typeof rawDiagnostics.platform === "string" && SAFE_PLATFORM_PATTERN.test(rawDiagnostics.platform)
          ? rawDiagnostics.platform
          : null;
        if (!appVersion || !platform) {
          return respond({ error: "Diagnostic summary is invalid", code: "invalid_diagnostics" }, 400, origin);
        }
        diagnostics.push(`App version: ${appVersion}`, `Platform: ${platform}`);
      }

      const fingerprintSecret = dependencies.env("SUPPORT_FINGERPRINT_SECRET");
      if (!fingerprintSecret || fingerprintSecret.length < 32) throw new Error("fingerprint_not_configured");
      actorFingerprint = await digest(`${fingerprintSecret}:${user ? `user:${user.id}` : `ip:${clientIp}`}`);
      payloadDigest = await digest(JSON.stringify({ category, subject, message, replyTo, diagnostics }));

      const { data: claimData, error: claimError } = await serviceClient.rpc("claim_support_delivery", {
        p_request_id: requestId,
        p_actor_fingerprint: actorFingerprint,
        p_payload_digest: payloadDigest,
      });
      if (claimError) throw new Error("delivery_claim_failed");
      const claim = claimData as JsonRecord | null;
      if (claim?.state === "accepted") {
        return respond({ accepted: true, request_id: requestId, duplicate: true }, 200, origin);
      }
      if (claim?.state === "in_progress") {
        const response = respond({ error: "This request is already being sent", code: "in_progress", request_id: requestId }, 409, origin);
        response.headers.set("Retry-After", PROCESSING_RETRY_SECONDS.toString());
        return response;
      }
      if (claim?.state !== "claimed") {
        return respond({ error: "Request ID cannot be reused for different content", code: "idempotency_conflict" }, 409, origin);
      }

      const providerMessageId = await sendWithBrevo({
        requestId,
        category,
        subject,
        message,
        replyTo,
        diagnostics,
        dependencies,
      });
      const { data: completed, error: completionError } = await serviceClient.rpc("complete_support_delivery", {
        p_request_id: requestId,
        p_actor_fingerprint: actorFingerprint,
        p_payload_digest: payloadDigest,
        p_accepted: true,
        p_provider_message_id: providerMessageId,
        p_failure_code: null,
      });
      if (completionError || completed !== true) throw new Error("delivery_completion_failed");
      console.info("support-contact accepted", { request_id: requestId, category });
      return respond({ accepted: true, request_id: requestId }, 200, origin);
    } catch (error) {
      if (serviceClient && requestId && actorFingerprint && payloadDigest) {
        try {
          await serviceClient.rpc("complete_support_delivery", {
            p_request_id: requestId,
            p_actor_fingerprint: actorFingerprint,
            p_payload_digest: payloadDigest,
            p_accepted: false,
            p_provider_message_id: null,
            p_failure_code: error instanceof Error ? error.name : "unknown",
          });
        } catch {
          // The delivery error remains the primary failure. The unresolved
          // receipt is safe to reclaim after its short processing timeout.
        }
      }
      if (error instanceof DistributedRateLimitUnavailableError) {
        const response = respond({ error: "Request verification is temporarily unavailable. Please try again later." }, 503, origin);
        response.headers.set("Retry-After", error.retryAfterSeconds.toString());
        return response;
      }
      console.error("support-contact failed", {
        request_id: requestId,
        error_type: error instanceof Error ? error.name : "unknown",
      });
      return respond({ error: "We could not send your message. Your text is still here so you can retry.", code: "delivery_failed", request_id: requestId }, 502, origin);
    }
  };
};

if (import.meta.main) Deno.serve(createSupportContactHandler());
