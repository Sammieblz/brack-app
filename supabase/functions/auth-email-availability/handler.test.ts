import { createAuthEmailAvailabilityHandler } from "./index.ts";

type RateLimitCall = {
  name?: string;
  identifier?: string;
  limit: number;
  windowMs: number;
  failClosed?: boolean;
};

type RpcCall = {
  name: string;
  args: Record<string, unknown>;
};

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const assertEquals = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
};

const testJsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const testOptionsResponse = () => new Response(null, { status: 204 });

const request = (body: unknown) =>
  new Request(
    "http://localhost/functions/v1/auth-email-availability",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "203.0.113.10",
      },
      body: JSON.stringify(body),
    },
  );

const makeHandler = (
  rpcResult: { data: unknown; error: unknown } = {
    data: false,
    error: null,
  },
  rateLimit?: (
    call: RateLimitCall,
  ) => Response | null,
) => {
  const rpcCalls: RpcCall[] = [];
  const rateLimitCalls: RateLimitCall[] = [];
  const client = {
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve(rpcResult);
    },
  };
  const handler = createAuthEmailAvailabilityHandler({
    createServiceClient: (() => client) as never,
    enforceRateLimit: (async (
      _request: Request,
      _client: unknown,
      options: RateLimitCall,
    ) => {
      rateLimitCalls.push(options);
      return rateLimit?.(options) ?? null;
    }) as never,
    jsonResponse: testJsonResponse as never,
    optionsResponse: testOptionsResponse as never,
  });

  return { handler, rateLimitCalls, rpcCalls };
};

Deno.test(
  "auth email availability handles preflight without initializing dependencies",
  async () => {
    const handler = createAuthEmailAvailabilityHandler({
      createServiceClient: (() => {
        throw new Error("Preflight must not initialize the service client");
      }) as never,
      optionsResponse: testOptionsResponse as never,
    });
    const response = await handler(
      new Request(
        "http://localhost/functions/v1/auth-email-availability",
        { method: "OPTIONS" },
      ),
    );

    assertEquals(response.status, 204);
    assertEquals(response.headers.get("cache-control"), "private, no-store");
  },
);

Deno.test(
  "auth email availability rejects unsupported methods before dependencies",
  async () => {
    const handler = createAuthEmailAvailabilityHandler({
      createServiceClient: (() => {
        throw new Error("Unsupported methods must not initialize dependencies");
      }) as never,
      jsonResponse: testJsonResponse as never,
    });
    const response = await handler(
      new Request(
        "http://localhost/functions/v1/auth-email-availability",
        { method: "GET" },
      ),
    );

    assertEquals(response.status, 405);
    assertEquals(response.headers.get("allow"), "POST, OPTIONS");
    assertEquals(response.headers.get("cache-control"), "private, no-store");
    assertEquals(await response.json(), { error: "Method not allowed" });
  },
);

Deno.test(
  "auth email availability rejects invalid input without calling the lookup RPC",
  async () => {
    const invalidBodies = [
      {},
      { email: null },
      { email: 42 },
      { email: "reader" },
      { email: `${"a".repeat(243)}@example.com` },
    ];

    for (const body of invalidBodies) {
      const { handler, rpcCalls } = makeHandler();
      const response = await handler(request(body));

      assertEquals(response.status, 400);
      assertEquals(response.headers.get("cache-control"), "private, no-store");
      assertEquals(await response.json(), {
        error: "Enter a valid email address",
        code: "invalid_email",
      });
      assertEquals(rpcCalls, []);
    }
  },
);

Deno.test(
  "auth email availability normalizes the address and returns an exact public contract",
  async () => {
    const { handler, rateLimitCalls, rpcCalls } = makeHandler({
      data: true,
      error: null,
    });
    const response = await handler(request({ email: " Reader@Example.COM " }));

    assertEquals(response.status, 200);
    assertEquals(response.headers.get("cache-control"), "private, no-store");
    assertEquals(await response.json(), { exists: true });
    assertEquals(rpcCalls, [{
      name: "auth_email_exists",
      args: { p_email: "reader@example.com" },
    }]);
    assertEquals(rateLimitCalls, [
      {
        name: "auth-email-availability-minute",
        limit: 5,
        windowMs: 60_000,
        failClosed: true,
      },
      {
        name: "auth-email-availability-hour",
        limit: 30,
        windowMs: 3_600_000,
        failClosed: true,
      },
    ]);
  },
);

Deno.test(
  "auth email availability returns exists false without exposing identity details",
  async () => {
    const { handler } = makeHandler({ data: false, error: null });
    const response = await handler(request({ email: "new@example.com" }));

    assertEquals(response.status, 200);
    assertEquals(await response.json(), { exists: false });
    assertEquals(response.headers.get("cache-control"), "private, no-store");
  },
);

Deno.test(
  "auth email availability stops at the minute rate limit",
  async () => {
    const { handler, rateLimitCalls, rpcCalls } = makeHandler(
      { data: false, error: null },
      (call) =>
        call.name === "auth-email-availability-minute"
          ? new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429,
            headers: { "Retry-After": "60" },
          })
          : null,
    );
    const response = await handler(request({ email: "reader@example.com" }));

    assertEquals(response.status, 429);
    assertEquals(response.headers.get("retry-after"), "60");
    assertEquals(response.headers.get("cache-control"), "private, no-store");
    assertEquals(rateLimitCalls.map((call) => call.name), [
      "auth-email-availability-minute",
    ]);
    assertEquals(rpcCalls, []);
  },
);

Deno.test(
  "auth email availability enforces the hourly rate limit before lookup",
  async () => {
    const { handler, rateLimitCalls, rpcCalls } = makeHandler(
      { data: false, error: null },
      (call) =>
        call.name === "auth-email-availability-hour"
          ? new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429,
            headers: { "Retry-After": "1200" },
          })
          : null,
    );
    const response = await handler(request({ email: "reader@example.com" }));

    assertEquals(response.status, 429);
    assertEquals(response.headers.get("retry-after"), "1200");
    assertEquals(response.headers.get("cache-control"), "private, no-store");
    assertEquals(rateLimitCalls.map((call) => call.name), [
      "auth-email-availability-minute",
      "auth-email-availability-hour",
    ]);
    assertEquals(rpcCalls, []);
  },
);

Deno.test(
  "auth email availability fails closed when the distributed limiter is unavailable",
  async () => {
    const rpcCalls: string[] = [];
    const client = {
      rpc: (name: string) => {
        rpcCalls.push(name);
        return Promise.resolve({
          data: null,
          error: new Error("sensitive limiter failure"),
        });
      },
    };
    const handler = createAuthEmailAvailabilityHandler({
      createServiceClient: (() => client) as never,
      jsonResponse: testJsonResponse as never,
      optionsResponse: testOptionsResponse as never,
    });
    const originalConsoleWarn = console.warn;
    console.warn = () => undefined;

    try {
      const response = await handler(request({ email: "reader@example.com" }));
      const body = await response.json();

      assertEquals(response.status, 503);
      assertEquals(response.headers.get("retry-after"), "60");
      assertEquals(response.headers.get("cache-control"), "private, no-store");
      assertEquals(body, {
        error:
          "Request verification is temporarily unavailable. Please try again later.",
      });
      assertEquals(rpcCalls, ["check_api_rate_limit"]);
      assert(
        !JSON.stringify(body).includes("sensitive limiter failure"),
        "Limiter details leaked",
      );
    } finally {
      console.warn = originalConsoleWarn;
    }
  },
);

Deno.test(
  "auth email availability sanitizes lookup failures and fails closed",
  async () => {
    const originalConsoleError = console.error;
    console.error = () => undefined;
    try {
      const { handler } = makeHandler({
        data: null,
        error: new Error("database details for reader@example.com"),
      });
      const response = await handler(request({ email: "reader@example.com" }));
      const body = await response.json();

      assertEquals(response.status, 500);
      assertEquals(response.headers.get("cache-control"), "private, no-store");
      assertEquals(body, { error: "Unable to verify email availability" });
      assert(
        !JSON.stringify(body).includes("reader@example.com"),
        "PII leaked",
      );
      assert(
        !JSON.stringify(body).includes("database details"),
        "Database details leaked",
      );
    } finally {
      console.error = originalConsoleError;
    }
  },
);

Deno.test(
  "auth email availability rejects a malformed RPC result",
  async () => {
    const originalConsoleError = console.error;
    console.error = () => undefined;
    try {
      const { handler } = makeHandler({ data: null, error: null });
      const response = await handler(request({ email: "reader@example.com" }));

      assertEquals(response.status, 500);
      assertEquals(await response.json(), {
        error: "Unable to verify email availability",
      });
      assertEquals(response.headers.get("cache-control"), "private, no-store");
    } finally {
      console.error = originalConsoleError;
    }
  },
);
