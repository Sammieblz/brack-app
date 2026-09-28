import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GamificationNotification } from "@/services/api/userNotifications";
import { useUserNotifications } from "./useUserNotifications";

const mocks = vi.hoisted(() => ({
  userId: "reader-a" as string | undefined,
  fetch: vi.fn(),
  markOne: vi.fn(),
  markAll: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.userId ? { id: mocks.userId } : null }),
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));
vi.mock("@/services/api", () => ({
  getUserNotifications: mocks.fetch,
  markUserNotificationRead: mocks.markOne,
  markAllUserNotificationsRead: mocks.markAll,
}));

const notification = (id = "update-a"): GamificationNotification => ({
  id,
  notification_type: "quest_completed",
  title: "Reading quest completed",
  body: "You completed a reading quest.",
  data: {},
  read_at: null,
  created_at: "2026-09-27T12:00:00.000Z",
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const clients: QueryClient[] = [];
// Subscribe to query presentation fields during render, as the real popover
// does, rather than reading TanStack's tracked fields only after an event.
const useObservedNotifications = () => {
  const result = useUserNotifications();
  return { ...result, query: { ...result.query } };
};
const wrapperFor = (
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
) => {
  clients.push(client);
  return {
    client,
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
};

beforeEach(() => {
  mocks.userId = "reader-a";
  vi.clearAllMocks();
  mocks.fetch.mockReset().mockResolvedValue([notification()]);
  mocks.markOne.mockReset().mockResolvedValue(undefined);
  mocks.markAll.mockReset().mockResolvedValue(undefined);
  onlineManager.setOnline(true);
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  onlineManager.setOnline(true);
});

describe("notification query and read feedback", () => {
  it("keeps unknown initial data distinct from a successful empty inbox", async () => {
    const fetch = deferred<GamificationNotification[]>();
    mocks.fetch.mockReturnValue(fetch.promise);
    const { result } = renderHook(useObservedNotifications, wrapperFor());
    expect(result.current.hasData).toBe(false);
    expect(result.current.query.isPending).toBe(true);
    await act(async () => fetch.resolve([]));
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(result.current.hasData).toBe(true);
    expect(result.current.notifications).toEqual([]);
  });

  it("exposes an initial failure and allows explicit retry", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("Unavailable"));
    const { result } = renderHook(useObservedNotifications, wrapperFor());
    await waitFor(() => expect(result.current.query.isError).toBe(true));
    expect(result.current.hasData).toBe(false);
    await act(async () => {
      await result.current.query.refetch();
    });
    await waitFor(() =>
      expect(result.current.notifications).toEqual([notification()])
    );
  });

  it("retains cached notifications while refreshing and after refresh failure", async () => {
    const { result } = renderHook(useObservedNotifications, wrapperFor());
    await waitFor(() => expect(result.current.unread).toBe(1));
    const refresh = deferred<GamificationNotification[]>();
    mocks.fetch.mockReturnValue(refresh.promise);
    act(() => {
      void result.current.query.refetch();
    });
    await waitFor(() => expect(result.current.query.isFetching).toBe(true));
    expect(result.current.notifications).toEqual([notification()]);
    await act(async () => refresh.reject(new Error("Refresh unavailable")));
    await waitFor(() => expect(result.current.query.isError).toBe(true));
    expect(result.current.hasData).toBe(true);
    expect(result.current.unread).toBe(1);
  });

  it("keeps the unread badge while a read is pending and rejects duplicate mutations", async () => {
    const write = deferred<void>();
    mocks.markOne.mockReturnValue(write.promise);
    const { result } = renderHook(useObservedNotifications, wrapperFor());
    await waitFor(() => expect(result.current.unread).toBe(1));
    act(() => {
      result.current.markRead("update-a");
      result.current.markRead("update-a");
      result.current.markRead(null);
    });
    await waitFor(() =>
      expect(result.current.pendingRead?.notificationId).toBe("update-a")
    );
    expect(mocks.markOne).toHaveBeenCalledTimes(1);
    expect(mocks.markAll).not.toHaveBeenCalled();
    expect(result.current.unread).toBe(1);
    const refresh = deferred<GamificationNotification[]>();
    mocks.fetch.mockReturnValue(refresh.promise);
    await act(async () => write.resolve());
    await waitFor(() => expect(result.current.unread).toBe(0));
    expect(result.current.notifications[0].read_at).toBeTruthy();
    await act(async () =>
      refresh.resolve([
        { ...notification(), read_at: "2026-09-27T12:01:00.000Z" },
      ])
    );
    await waitFor(() => expect(result.current.readSucceeded).toBe(true));
  });

  it("preserves unread state and retry feedback across header remount after a read failure", async () => {
    mocks.markOne.mockRejectedValueOnce(new Error("Write unavailable"));
    const context = wrapperFor();
    const first = renderHook(useObservedNotifications, context);
    await waitFor(() => expect(first.result.current.unread).toBe(1));
    act(() => first.result.current.markRead("update-a"));
    await waitFor(() =>
      expect(first.result.current.readError?.notificationId).toBe("update-a")
    );
    expect(first.result.current.unread).toBe(1);
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    first.unmount();
    const second = renderHook(useObservedNotifications, context);
    expect(second.result.current.readError?.notificationId).toBe("update-a");
    mocks.fetch.mockResolvedValue([
      { ...notification(), read_at: "2026-09-27T12:01:00.000Z" },
    ]);
    act(() =>
      second.result.current.markRead(
        second.result.current.readError!.notificationId
      )
    );
    await waitFor(() => expect(second.result.current.readSucceeded).toBe(true));
    expect(second.result.current.readError).toBeUndefined();
    expect(second.result.current.unread).toBe(0);
  });

  it("retains a pending read lock when a second header mounts", async () => {
    const write = deferred<void>();
    mocks.markOne.mockReturnValue(write.promise);
    const context = wrapperFor();
    const first = renderHook(useObservedNotifications, context);
    await waitFor(() => expect(first.result.current.unread).toBe(1));
    act(() => first.result.current.markRead("update-a"));
    await waitFor(() => expect(first.result.current.pendingRead).toBeDefined());
    first.unmount();
    const second = renderHook(useObservedNotifications, context);
    expect(second.result.current.pendingRead?.notificationId).toBe("update-a");
    act(() => second.result.current.markRead("update-a"));
    expect(mocks.markOne).toHaveBeenCalledTimes(1);
    await act(async () => write.reject(new Error("Unavailable")));
    await waitFor(() => expect(second.result.current.readError).toBeDefined());
  });

  it("keeps mark-all failures unread and reports successful retry only after acknowledgement", async () => {
    mocks.fetch.mockResolvedValue([notification(), notification("update-b")]);
    mocks.markAll.mockRejectedValueOnce(new Error("Write unavailable"));
    const { result } = renderHook(useObservedNotifications, wrapperFor());
    await waitFor(() => expect(result.current.unread).toBe(2));
    act(() => result.current.markRead(null));
    await waitFor(() =>
      expect(result.current.readError?.notificationId).toBeNull()
    );
    expect(result.current.unread).toBe(2);
    expect(mocks.toast).not.toHaveBeenCalled();
    const write = deferred<void>();
    mocks.markAll.mockReturnValue(write.promise);
    act(() => result.current.markRead(null));
    await waitFor(() =>
      expect(result.current.pendingRead?.notificationId).toBeNull()
    );
    expect(result.current.unread).toBe(2);
    mocks.fetch.mockResolvedValue(
      [notification(), notification("update-b")].map((item) => ({
        ...item,
        read_at: "2026-09-27T12:01:00.000Z",
      }))
    );
    await act(async () => write.resolve());
    await waitFor(() => expect(result.current.readSucceeded).toBe(true));
    expect(result.current.unread).toBe(0);
  });

  it("does not turn a confirmed read into a failed write when its follow-up refresh fails", async () => {
    const { result } = renderHook(useObservedNotifications, wrapperFor());
    await waitFor(() => expect(result.current.unread).toBe(1));
    mocks.fetch.mockRejectedValue(new Error("Refresh unavailable"));
    act(() => result.current.markRead("update-a"));
    await waitFor(() => expect(result.current.readSucceeded).toBe(true));
    await waitFor(() => expect(result.current.query.isError).toBe(true));
    expect(result.current.readError).toBeUndefined();
    expect(result.current.unread).toBe(0);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("does not leak previous-reader feedback or content when a pending write rejects", async () => {
    const write = deferred<void>();
    mocks.markOne.mockReturnValue(write.promise);
    const { result, rerender } = renderHook(
      useObservedNotifications,
      wrapperFor()
    );
    await waitFor(() => expect(result.current.unread).toBe(1));
    act(() => result.current.markRead("update-a"));
    await waitFor(() => expect(result.current.pendingRead).toBeDefined());
    mocks.userId = "reader-b";
    mocks.fetch.mockResolvedValue([notification("reader-b-update")]);
    rerender();
    await waitFor(() =>
      expect(result.current.notifications[0]?.id).toBe("reader-b-update")
    );
    await act(async () => write.reject(new Error("Old write failed")));
    expect(result.current.readError).toBeUndefined();
    expect(result.current.pendingRead).toBeUndefined();
    expect(result.current.unread).toBe(1);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("does not fetch or mutate without an authenticated reader", () => {
    mocks.userId = undefined;
    const { result } = renderHook(useObservedNotifications, wrapperFor());
    act(() => result.current.markRead(null));
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.markAll).not.toHaveBeenCalled();
  });

  it("does not announce a previous reader's failed write after their header unmounts", async () => {
    const write = deferred<void>();
    mocks.markOne.mockReturnValue(write.promise);
    const context = wrapperFor();
    const first = renderHook(useObservedNotifications, context);
    await waitFor(() => expect(first.result.current.unread).toBe(1));
    act(() => first.result.current.markRead("update-a"));
    await waitFor(() => expect(first.result.current.pendingRead).toBeDefined());
    first.unmount();
    mocks.userId = "reader-b";
    mocks.fetch.mockResolvedValue([notification("reader-b-update")]);
    const second = renderHook(useObservedNotifications, context);
    await waitFor(() =>
      expect(second.result.current.notifications[0]?.id).toBe("reader-b-update")
    );
    await act(async () => write.reject(new Error("Old write failed")));
    expect(second.result.current.readError).toBeUndefined();
    expect(second.result.current.pendingRead).toBeUndefined();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("reports a paused initial query and does not queue a read to replay on reconnection", async () => {
    onlineManager.setOnline(false);
    mocks.markOne.mockRejectedValue(new Error("Offline"));
    const { result } = renderHook(useObservedNotifications, wrapperFor());
    expect(result.current.query.fetchStatus).toBe("paused");
    act(() => result.current.markRead("update-a"));
    await waitFor(() =>
      expect(result.current.readError?.notificationId).toBe("update-a")
    );
    act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(mocks.markOne).toHaveBeenCalledTimes(1);
  });

  it("starts a same-reader read even when navigation removes its header before the mutation microtask", async () => {
    const write = deferred<void>();
    mocks.markOne.mockReturnValue(write.promise);
    const context = wrapperFor();
    const first = renderHook(useObservedNotifications, context);
    await waitFor(() => expect(first.result.current.unread).toBe(1));
    act(() => {
      first.result.current.markRead("update-a");
      first.unmount();
    });
    await waitFor(() =>
      expect(mocks.markOne).toHaveBeenCalledWith("update-a", "reader-a")
    );
    const second = renderHook(useObservedNotifications, context);
    expect(second.result.current.pendingRead?.notificationId).toBe("update-a");
    await act(async () => write.reject(new Error("Read failed")));
    await waitFor(() => expect(second.result.current.readError).toBeDefined());
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("does not locally mark newly arrived notifications read after an earlier mark-all completes", async () => {
    const write = deferred<void>();
    mocks.markAll.mockReturnValue(write.promise);
    const context = wrapperFor();
    const { result } = renderHook(useObservedNotifications, context);
    await waitFor(() => expect(result.current.unread).toBe(1));
    act(() => result.current.markRead(null));
    await waitFor(() => expect(result.current.pendingRead).toBeDefined());
    act(() =>
      context.client.setQueryData(
        ["user-notifications", "reader-a"],
        [notification(), notification("arrived-later")]
      )
    );
    const refresh = deferred<GamificationNotification[]>();
    mocks.fetch.mockReturnValue(refresh.promise);
    await act(async () => write.resolve());
    await waitFor(() => expect(result.current.readSucceeded).toBe(true));
    expect(
      result.current.notifications.find((item) => item.id === "update-a")
        ?.read_at
    ).toBeTruthy();
    expect(
      result.current.notifications.find((item) => item.id === "arrived-later")
        ?.read_at
    ).toBeNull();
    expect(result.current.unread).toBe(1);
    await act(async () =>
      refresh.resolve([
        { ...notification(), read_at: "2026-09-27T12:01:00.000Z" },
        notification("arrived-later"),
      ])
    );
  });

  it("clears obsolete mark-all failure feedback when its original targets are confirmed read", async () => {
    mocks.markAll.mockRejectedValue(new Error("Response unavailable"));
    const { result } = renderHook(useObservedNotifications, wrapperFor());
    await waitFor(() => expect(result.current.unread).toBe(1));
    act(() => result.current.markRead(null));
    await waitFor(() => expect(result.current.readError).toBeDefined());
    mocks.fetch.mockResolvedValue([
      { ...notification(), read_at: "2026-09-27T12:01:00.000Z" },
      notification("arrived-later"),
    ]);
    await act(async () => {
      await result.current.query.refetch();
    });
    await waitFor(() => expect(result.current.readError).toBeUndefined());
    expect(result.current.unread).toBe(1);
  });
});
