import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn(), invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("./auth", () => ({ getCurrentAuthUser: mocks.getUser }));
vi.mock("./client", () => ({
  invokeFunction: mocks.invoke,
  getApiErrorStatus: (error: { status?: number; context?: { status?: number } }) => error?.context?.status ?? error?.status ?? null,
}));
vi.mock("@/services/contentSnapshots", () => ({ withContentSnapshot: (_scope: string, _key: string, read: () => Promise<unknown>) => read() }));
vi.mock("@/services/local", () => ({ profilePreferencesRepo: {} }));
vi.mock("@/services/connectivity", () => ({ isConnectivityAvailable: vi.fn() }));
vi.mock("@/services/sync/engine", () => ({ readingCoreSync: {} }));
vi.mock("./gamification", () => ({ getPublicGamificationProfile: vi.fn() }));
vi.mock("@/utils/normalizeUploadMedia", () => ({ normalizeUploadMedia: vi.fn() }));

import { fetchUserProfileWithStats } from "./profiles";
import { fetchConversationDetail, fetchConversations } from "./messaging";

type Response = { data: unknown; error: unknown; status: number };
let responses: Response[];

beforeEach(() => {
  vi.resetAllMocks();
  responses = [];
  mocks.getUser.mockResolvedValue({ id: "viewer" });
  mocks.from.mockImplementation(() => {
    const response = responses.shift();
    const builder: Record<string, unknown> = {
      then: (resolve: (value: Response | undefined) => unknown) => Promise.resolve(response).then(resolve),
    };
    for (const method of ["select", "or", "eq", "order", "single", "maybeSingle"]) builder[method] = vi.fn(() => builder);
    return builder;
  });
});

describe("social read access error metadata", () => {
  it("marks a confirmed profile block as forbidden", async () => {
    responses.push({ data: { id: "block" }, error: null, status: 200 });
    await expect(fetchUserProfileWithStats("profile")).rejects.toMatchObject({ status: 403, message: "Profile unavailable" });
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403, 404])("preserves a profile read's HTTP %i metadata", async (status) => {
    responses.push({ data: null, error: null, status: 200 }, { data: null, error: { message: "Denied" }, status });
    await expect(fetchUserProfileWithStats("profile")).rejects.toMatchObject({ status });
  });

  it.each([401, 403])("does not fall back to legacy thread reads after HTTP %i", async (status) => {
    const error = Object.assign(new Error("Denied"), { context: { status } });
    mocks.invoke.mockRejectedValueOnce(error);
    await expect(fetchConversationDetail("thread")).rejects.toBe(error);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([401, 403])("does not fall back to legacy inbox reads after HTTP %i", async (status) => {
    const error = Object.assign(new Error("Denied"), { status });
    mocks.invoke.mockRejectedValueOnce(error);
    await expect(fetchConversations()).rejects.toBe(error);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([
    { name: "missing conversation", data: null, error: null, responseStatus: 200, expectedStatus: 404 },
    { name: "nonparticipant", data: { id: "thread", participant_one_id: "other-a", participant_two_id: "other-b" }, error: null, responseStatus: 200, expectedStatus: 403 },
    { name: "RLS denial", data: null, error: { message: "Denied" }, responseStatus: 403, expectedStatus: 403 },
  ])("marks a legacy $name without losing compatibility fallback", async ({ data, error, responseStatus, expectedStatus }) => {
    mocks.invoke.mockRejectedValueOnce(Object.assign(new Error("Function unavailable"), { status: 404 }));
    responses.push({ data, error, status: responseStatus });
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(fetchConversationDetail("thread")).rejects.toMatchObject({ status: expectedStatus });
    expect(mocks.from).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it("marks a legacy thread read after sign-out as unauthorized", async () => {
    mocks.invoke.mockRejectedValueOnce(Object.assign(new Error("Function unavailable"), { status: 503 }));
    mocks.getUser.mockResolvedValueOnce(null);
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(fetchConversationDetail("thread")).rejects.toMatchObject({ status: 401 });
    expect(mocks.from).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it.each(["profile", "messages"])("preserves denied legacy %s response metadata", async (resource) => {
    mocks.invoke.mockRejectedValueOnce(Object.assign(new Error("Function unavailable"), { status: 404 }));
    responses.push(
      { data: { id: "thread", participant_one_id: "viewer", participant_two_id: "other" }, error: null, status: 200 },
      { data: resource === "profile" ? null : { id: "other" }, error: resource === "profile" ? { message: "Denied" } : null, status: resource === "profile" ? 403 : 200 },
      { data: null, error: resource === "messages" ? { message: "Denied" } : null, status: resource === "messages" ? 403 : 200 },
    );
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(fetchConversationDetail("thread")).rejects.toMatchObject({ status: 403 });
    expect(mocks.from).toHaveBeenCalledTimes(3);
    log.mockRestore();
  });
});
