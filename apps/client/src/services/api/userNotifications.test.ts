import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
} from "./userNotifications";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), http: vi.fn() }));
vi.mock("./auth", () => ({ getCurrentAuthUser: mocks.auth }));
vi.mock("@/integrations/supabase/client", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    supabase: createClient(
      "https://notifications.invalid",
      "synthetic-test-key",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { fetch: mocks.http },
      }
    ),
  };
});

const item = {
  id: "notification-a",
  notification_type: "quest_completed",
  title: "Quest completed",
  body: "A synthetic update",
  data: {},
  read_at: null,
  created_at: "2026-09-27T12:00:00.000Z",
};
const response = (status = 200) =>
  new Response(
    JSON.stringify(status === 200 ? [item] : { message: "Unavailable" }),
    {
      status,
      headers: { "content-type": "application/json" },
    }
  );
const operations = [
  { name: "fetch", run: () => getUserNotifications("reader-a") },
  {
    name: "mark one",
    run: () => markUserNotificationRead("notification-a", "reader-a"),
  },
  { name: "mark all", run: () => markAllUserNotificationsRead("reader-a") },
];

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ id: "reader-a" });
  mocks.http.mockReset().mockImplementation(async () => response());
});

describe("notification service reader boundaries", () => {
  it("binds a fetch to the expected reader and forwards query cancellation", async () => {
    const controller = new AbortController();
    expect(await getUserNotifications("reader-a", controller.signal)).toEqual([
      item,
    ]);
    const [requestUrl, options] = mocks.http.mock.calls[0];
    const url = new URL(String(requestUrl));
    expect(url.pathname).toBe("/rest/v1/user_notifications");
    expect(url.searchParams.get("user_id")).toBe("eq.reader-a");
    expect(url.searchParams.get("limit")).toBe("30");
    expect(options.signal).toBe(controller.signal);
    expect(mocks.auth).toHaveBeenCalledTimes(2);
  });

  it("scopes a single read update to both notification and expected reader", async () => {
    await markUserNotificationRead("notification-a", "reader-a");
    const [requestUrl, options] = mocks.http.mock.calls[0];
    const url = new URL(String(requestUrl));
    expect(url.searchParams.get("user_id")).toBe("eq.reader-a");
    expect(url.searchParams.get("id")).toBe("eq.notification-a");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body)).toEqual({ read_at: expect.any(String) });
    expect(mocks.auth).toHaveBeenCalledTimes(2);
  });

  it("scopes mark-all to the expected reader's unread notifications", async () => {
    await markAllUserNotificationsRead("reader-a");
    const [requestUrl, options] = mocks.http.mock.calls[0];
    const url = new URL(String(requestUrl));
    expect(url.searchParams.get("user_id")).toBe("eq.reader-a");
    expect(url.searchParams.get("read_at")).toBe("is.null");
    expect(options.method).toBe("PATCH");
    expect(mocks.auth).toHaveBeenCalledTimes(2);
  });

  for (const operation of operations) {
    it.each([null, { id: "reader-b" }])(
      `${operation.name} rejects missing or changed readers before querying`,
      async (user) => {
        mocks.auth.mockResolvedValue(user);
        await expect(operation.run()).rejects.toThrow("Reader changed");
        expect(mocks.http).not.toHaveBeenCalled();
      }
    );

    it(`${operation.name} does not publish success after the authenticated reader changes during the request`, async () => {
      mocks.http.mockImplementation(async () => {
        mocks.auth.mockResolvedValue({ id: "reader-b" });
        return response();
      });
      await expect(operation.run()).rejects.toThrow("Reader changed");
      expect(
        new URL(String(mocks.http.mock.calls[0][0])).searchParams.get("user_id")
      ).toBe("eq.reader-a");
    });
  }

  it("propagates a failed server update rather than confirming the read flag", async () => {
    mocks.http.mockImplementation(async () => response(503));
    await expect(
      markAllUserNotificationsRead("reader-a")
    ).rejects.toMatchObject({ message: "Unavailable" });
  });
});
