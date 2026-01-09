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

/**
 * Rate limiting implementation
 * 
 * NOTE: This uses in-memory storage which has limitations:
 * - Only works within a single edge function instance
 * - Rate limits reset when the instance restarts
 * - Multiple instances don't share rate limit state
 * 
 * For production use, consider:
 * - Using Supabase's built-in rate limiting (if available)
 * - Implementing distributed rate limiting with Supabase Storage or external Redis
 * - Using a third-party rate limiting service
 * 
 * TODO: Implement distributed rate limiting for production
 */
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
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);

    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": existing.resetAt.toString(),
        },
      },
    );
  }

  existing.count += 1;
  buckets.set(key, existing);

  return null;
};
