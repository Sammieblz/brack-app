import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), user: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("./auth", () => ({ getCurrentAuthUser: mocks.user }));
vi.mock("./client", () => ({ invokeFunction: mocks.invoke, getApiErrorStatus: vi.fn() }));
vi.mock("@/services/contentSnapshots", () => ({ withContentSnapshot: vi.fn() }));
vi.mock("@/utils/normalizeUploadMedia", () => ({ normalizeUploadMedia: vi.fn() }));

import { markConversationRead } from "./messaging";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.user.mockResolvedValue({ id: "reader" });
});
afterEach(() => vi.restoreAllMocks());

describe("read receipt fallback outcomes", () => {
  it("keeps the confirmed primary result without a second write", async () => {
    mocks.invoke.mockResolvedValue(undefined);
    await markConversationRead("thread", "message");
    expect(mocks.invoke).toHaveBeenCalledWith("mark-conversation-read", { body: { conversation_id: "thread", last_read_message_id: "message" } });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([null, { message: "Read receipt unavailable", code: "42501" }])("propagates the actual legacy outcome %j", async error => {
    mocks.invoke.mockRejectedValue(new Error("Function unavailable"));
    const builder = { update: vi.fn(), eq: vi.fn(), neq: vi.fn(), then: (resolve: (value: { error: typeof error }) => unknown) => Promise.resolve({ error }).then(resolve) };
    builder.update.mockReturnValue(builder); builder.eq.mockReturnValue(builder); builder.neq.mockReturnValue(builder);
    mocks.from.mockReturnValue(builder);
    const result = markConversationRead("thread", "last");
    if (error) await expect(result).rejects.toBe(error);
    else await expect(result).resolves.toBeUndefined();
    expect(builder.update).toHaveBeenCalledWith({ is_read: true });
    expect(builder.eq.mock.calls).toEqual([["conversation_id", "thread"], ["is_read", false]]);
    expect(builder.neq).toHaveBeenCalledWith("sender_id", "reader");
  });

  it("preserves primary failure when no account can own the fallback", async () => {
    const error = new Error("Sign in again");
    mocks.invoke.mockRejectedValue(error); mocks.user.mockResolvedValue(null);
    await expect(markConversationRead("thread")).rejects.toBe(error);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
