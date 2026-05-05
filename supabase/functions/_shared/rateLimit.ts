import { getCorsHeaders } from "./cors.ts";

type RateLimitOptions = {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
  /** Identifier for grouping (function name). */
  name?: string;
  /** Optional explicit identifier (e.g., user id). */
  identifier?: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

type DistributedRateLimitResult = {
  allowed?: boolean;
  limit?: number;
  remaining?: number;
  reset_at?: string;
  retry_after_seconds?: number;
};

type RateLimitClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
};

// Simple in-memory store scoped to the function instance.
const buckets = new Map<string, Bucket>();

const getClientIdentifier = (req: Request) => {
  const headerCandidates = [
    "cf-connecting-ip",
    "x-real-ip",
    "x-forwarded-for",
  ];

  for (const header of headerCandidates) {
    const value = req.headers.get(header);
    if (value) {
      // x-forwarded-for can contain a list; take the first entry.
      return value.split(",")[0].trim();
    }
  }

  return "anonymous";
};

const rateLimitResponse = (
  req: Request,
  limit: number,
  remaining: number,
  resetAt: string,
  retryAfterSeconds: number,
): Response => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  return new Response(
    JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": retryAfterSeconds.toString(),
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": Math.max(0, remaining).toString(),
        "X-RateLimit-Reset": resetAt,
      },
    },
  );
};

export const rateLimit = (
  req: Request,
  options: RateLimitOptions,
): Response | null => {
  const { limit, windowMs, name = "global", identifier } = options;
  const key = `${name}:${identifier || getClientIdentifier(req)}`;
  const now = Date.now();

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (existing.count >= limit) {
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
    return rateLimitResponse(
      req,
      limit,
      0,
      existing.resetAt.toString(),
      retryAfter,
    );
  }

  existing.count += 1;
  buckets.set(key, existing);

  return null;
};

export const enforceRateLimit = async (
  req: Request,
  supabaseClient: RateLimitClient,
  options: RateLimitOptions,
): Promise<Response | null> => {
  const { limit, windowMs, name = "global", identifier } = options;
  const bucketKey = `${name}:${identifier || getClientIdentifier(req)}`;

  try {
    const { data, error } = await supabaseClient.rpc("check_api_rate_limit", {
      p_bucket_key: bucketKey,
      p_limit: limit,
      p_window_seconds: Math.ceil(windowMs / 1000),
    });

    if (error) throw error;

    const result = (data ?? {}) as DistributedRateLimitResult;
    if (result.allowed === false) {
      return rateLimitResponse(
        req,
        Number(result.limit ?? limit),
        Number(result.remaining ?? 0),
        String(result.reset_at ?? Date.now() + windowMs),
        Number(result.retry_after_seconds ?? Math.ceil(windowMs / 1000)),
      );
    }

    return null;
  } catch (error) {
    console.warn("Distributed rate limit unavailable; falling back to instance limiter", {
      bucketKey,
      error: error instanceof Error ? error.message : error,
    });
    return rateLimit(req, options);
  }
};
