import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  markAuthenticationRequired: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

vi.mock("@/services/connectivity", () => ({
  isRetryableConnectivityError: () => false,
  markAuthenticationRequired: mocks.markAuthenticationRequired,
  markConnectivityFailure: vi.fn(),
  markConnectivitySuccess: vi.fn(),
}));

import { invokeFunction } from "./client";

beforeEach(() => vi.clearAllMocks());

describe("support function auth signaling", () => {
  it("does not misclassify a support security-check 403 as a missing session", async () => {
    const failure = { context: new Response("Forbidden", { status: 403 }) };
    mocks.invoke.mockResolvedValueOnce({ data: null, error: failure });

    await expect(invokeFunction("support-contact", {}, { forbiddenRequiresAuth: false }))
      .rejects.toBe(failure);
    expect(mocks.markAuthenticationRequired).not.toHaveBeenCalled();
  });

  it("still signals an actual 401 as requiring authentication", async () => {
    const failure = { context: new Response("Unauthorized", { status: 401 }) };
    mocks.invoke.mockResolvedValueOnce({ data: null, error: failure });

    await expect(invokeFunction("support-contact", {}, { forbiddenRequiresAuth: false }))
      .rejects.toBe(failure);
    expect(mocks.markAuthenticationRequired).toHaveBeenCalledOnce();
  });
});
