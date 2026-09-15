import { createSupportContactHandler } from "./index.ts";

type RpcCall = { name: string; args: Record<string, unknown> };
type FetchCall = { url: string; init?: RequestInit };

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const assertEquals = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
};

const REQUEST_ID = "76000000-0000-4000-8000-000000000001";
const validBody = {
  request_id: REQUEST_ID,
  category: "bug",
  subject: "Library will not open",
  message: "The library stays blank after I reopen the application.",
  include_diagnostics: true,
  diagnostics: { app_version: "1.4.0", platform: "web" },
};

const makeRequest = (
  body: unknown,
  { authenticated = true, origin = "https://brack-app.com" } = {},
) => new Request("http://localhost/functions/v1/support-contact", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Forwarded-For": "203.0.113.76",
    ...(authenticated ? { Authorization: "Bearer valid-user-token" } : {}),
    ...(origin ? { Origin: origin } : {}),
  },
  body: JSON.stringify(body),
});

const makeHandler = ({
  authenticated = true,
  claimState = "claimed",
  providerStatus = 201,
  mode = "production",
  rateLimitResponse = null as Response | null,
} = {}) => {
  const rpcCalls: RpcCall[] = [];
  const fetchCalls: FetchCall[] = [];
  const envValues: Record<string, string> = {
    ALLOWED_ORIGINS: "https://brack-app.com",
    ENVIRONMENT: "production",
    BREVO_API_KEY: "server-only-test-key",
    SUPPORT_FROM_EMAIL: "mailer@brack-app.com",
    SUPPORT_DELIVERY_MODE: mode,
    SUPPORT_STAGING_SINK_EMAIL: "support-sink@example.net",
    SUPPORT_FINGERPRINT_SECRET: "a-test-secret-that-is-at-least-thirty-two-characters",
    TURNSTILE_SECRET_KEY: "turnstile-server-secret",
    TURNSTILE_ALLOWED_HOSTNAMES: "brack-app.com",
  };
  const client = {
    auth: {
      getUser: () => Promise.resolve(authenticated
        ? { data: { user: { id: "reader-76", email: "reader@example.com" } }, error: null }
        : { data: { user: null }, error: new Error("anonymous") }),
    },
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      if (name === "claim_support_delivery") {
        return Promise.resolve({ data: { state: claimState }, error: null });
      }
      return Promise.resolve({ data: true, error: null });
    },
  };
  const handler = createSupportContactHandler({
    createServiceClient: (() => client) as never,
    enforceRateLimit: (async () => rateLimitResponse) as never,
    env: (name) => envValues[name],
    sleep: () => Promise.resolve(),
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      fetchCalls.push({ url, init });
      if (url.includes("siteverify")) {
        return new Response(JSON.stringify({
          success: true,
          action: "support_contact",
          hostname: "brack-app.com",
        }), { status: 200 });
      }
      return new Response(
        providerStatus === 201 ? JSON.stringify({ messageId: "brevo-message-76" }) : "{}",
        { status: providerStatus },
      );
    }) as typeof fetch,
    jsonResponse: ((body: unknown, status = 200) => new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as never,
    optionsResponse: (() => new Response(null, { status: 204 })) as never,
  });

  return { handler, fetchCalls, rpcCalls };
};

Deno.test("support contact sends authenticated submissions to the fixed production mailbox", async () => {
  const { handler, fetchCalls, rpcCalls } = makeHandler();
  const response = await handler(makeRequest(validBody));
  const responseBody = await response.json();

  assertEquals(response.status, 200);
  assertEquals(responseBody, { accepted: true, request_id: REQUEST_ID });
  const providerCall = fetchCalls.find((call) => call.url.includes("api.brevo.com"));
  assert(providerCall, "Brevo was not called");
  const providerBody = JSON.parse(String(providerCall?.init?.body));
  assertEquals(providerBody.to, [{ email: "support@brack-app.com", name: "Brack Support" }]);
  assertEquals(providerBody.replyTo, { email: "reader@example.com" });
  assertEquals(providerBody.htmlContent, undefined);
  assert(String(providerBody.textContent).includes("App version: 1.4.0"), "diagnostics missing");
  assertEquals((providerCall?.init?.headers as Record<string, string>)["Idempotency-Key"], REQUEST_ID);
  assertEquals(rpcCalls.map((call) => call.name), [
    "claim_support_delivery",
    "complete_support_delivery",
  ]);
});

Deno.test("support contact uses the staging sink and never the real mailbox outside production", async () => {
  const { handler, fetchCalls } = makeHandler({ mode: "staging" });
  const response = await handler(makeRequest(validBody));
  const providerCall = fetchCalls.find((call) => call.url.includes("api.brevo.com"));
  const providerBody = JSON.parse(String(providerCall?.init?.body));

  assertEquals(response.status, 200);
  assertEquals(providerBody.to, [{ email: "support-sink@example.net", name: "Brack Support" }]);
});

Deno.test("support contact never reports success when Brevo does not accept the message", async () => {
  const { handler, fetchCalls, rpcCalls } = makeHandler({ providerStatus: 503 });
  const originalError = console.error;
  console.error = () => undefined;
  try {
    const response = await handler(makeRequest(validBody));
    const body = await response.json();
    assertEquals(response.status, 502);
    assertEquals(body.accepted, undefined);
    assertEquals(fetchCalls.filter((call) => call.url.includes("api.brevo.com")).length, 2);
    assertEquals(
      rpcCalls.filter((call) => call.name === "complete_support_delivery").length,
      1,
    );
  } finally {
    console.error = originalError;
  }
});

Deno.test("support contact returns an accepted duplicate without sending again", async () => {
  const { handler, fetchCalls } = makeHandler({ claimState: "accepted" });
  const response = await handler(makeRequest(validBody));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    accepted: true,
    request_id: REQUEST_ID,
    duplicate: true,
  });
  assertEquals(fetchCalls.length, 0);
});

Deno.test("support contact rejects a request ID reused for different content", async () => {
  const { handler, fetchCalls } = makeHandler({ claimState: "conflict" });
  const response = await handler(makeRequest(validBody));

  assertEquals(response.status, 409);
  assertEquals((await response.json()).code, "idempotency_conflict");
  assertEquals(fetchCalls.length, 0);
});

Deno.test("anonymous support requires and verifies Turnstile before delivery", async () => {
  const { handler, fetchCalls } = makeHandler({ authenticated: false });
  const missingToken = await handler(makeRequest({
    ...validBody,
    reply_email: "guest@example.com",
  }, { authenticated: false }));
  assertEquals(missingToken.status, 403);

  const accepted = await handler(makeRequest({
    ...validBody,
    reply_email: "guest@example.com",
    turnstile_token: "valid-turnstile-token",
  }, { authenticated: false }));
  assertEquals(accepted.status, 200);
  assert(fetchCalls.some((call) => call.url.includes("siteverify")), "Turnstile was not verified");
  const providerCall = fetchCalls.find((call) => call.url.includes("api.brevo.com"));
  const providerBody = JSON.parse(String(providerCall?.init?.body));
  assertEquals(providerBody.replyTo, { email: "guest@example.com" });
});

Deno.test("support contact rejects header injection, oversized fields, and recipient override", async () => {
  const { handler, fetchCalls } = makeHandler();
  for (const body of [
    { ...validBody, subject: "Hello\r\nBcc: attacker@example.com" },
    { ...validBody, message: "x".repeat(5_001) },
    { ...validBody, category: "support@attacker.example" },
  ]) {
    const response = await handler(makeRequest(body));
    assertEquals(response.status, 400);
  }
  assertEquals(fetchCalls.length, 0);

  const accepted = await handler(makeRequest({
    ...validBody,
    recipient: "attacker@example.com",
  }));
  assertEquals(accepted.status, 200);
  const providerBody = JSON.parse(String(fetchCalls[0].init?.body));
  assertEquals(providerBody.to[0].email, "support@brack-app.com");
});

Deno.test("support contact fails closed on rate limits and disallowed origins", async () => {
  const limited = new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
    status: 429,
    headers: { "Retry-After": "60" },
  });
  const limitedHandler = makeHandler({ rateLimitResponse: limited });
  assertEquals((await limitedHandler.handler(makeRequest(validBody))).status, 429);
  assertEquals(limitedHandler.fetchCalls.length, 0);

  const { handler, fetchCalls } = makeHandler();
  const forbidden = await handler(makeRequest(validBody, {
    origin: "https://attacker.example",
  }));
  assertEquals(forbidden.status, 403);
  assertEquals(fetchCalls.length, 0);
});

Deno.test("support contact omits diagnostics unless the reader consents", async () => {
  const { handler, fetchCalls } = makeHandler();
  const response = await handler(makeRequest({
    ...validBody,
    include_diagnostics: false,
    diagnostics: { app_version: "secret", platform: "web", logs: "private" },
  }));
  const providerBody = JSON.parse(String(fetchCalls[0].init?.body));

  assertEquals(response.status, 200);
  assert(!String(providerBody.textContent).includes("App version:"), "diagnostics leaked");
  assert(!String(providerBody.textContent).includes("private"), "unapproved fields leaked");
});
