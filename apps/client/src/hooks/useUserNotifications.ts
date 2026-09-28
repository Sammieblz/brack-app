import { useEffect, useRef } from "react";
import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  getUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
  type GamificationNotification,
} from "@/services/api";

interface ReadTarget {
  userId: string;
  notificationId: string | null;
  notificationIds: string[];
}

export const useUserNotifications = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const currentUserId = useRef(userId);
  currentUserId.current = userId;
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ["user-notifications", userId] as const;
  const mutationKey = ["user-notifications-read", userId] as const;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getUserNotifications(userId!, signal),
    enabled: Boolean(userId),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });

  const mutation = useMutation({
    mutationKey,
    // Read flags have no durable offline queue. Fail now and offer a retry;
    // never replay a paused request after the authenticated reader changes.
    networkMode: "always",
    retry: false,
    mutationFn: async (target: ReadTarget) => {
      if (!target.userId || currentUserId.current !== target.userId)
        throw new Error("Reader changed");
      if (target.notificationId)
        await markUserNotificationRead(target.notificationId, target.userId);
      else await markAllUserNotificationsRead(target.userId);
      return target;
    },
    onSuccess: async (target) => {
      if (currentUserId.current !== target.userId) return;
      const key = ["user-notifications", target.userId] as const;
      // A fetch started before the write must not replace its confirmed read
      // state. A subsequent refresh is ancillary to the successful mutation.
      try {
        await queryClient.cancelQueries({ queryKey: key, exact: true });
        if (currentUserId.current !== target.userId) return;
        const readAt = new Date().toISOString();
        queryClient.setQueryData<GamificationNotification[]>(key, (previous) =>
          previous?.map((item) =>
            !item.read_at && target.notificationIds.includes(item.id)
              ? { ...item, read_at: readAt }
              : item
          )
        );
        void queryClient.invalidateQueries({ queryKey: key, exact: true });
      } catch (error) {
        console.error(
          "Notifications marked as read; the list could not refresh",
          error
        );
      }
    },
    onError: (_error, target) => {
      if (
        target.notificationId &&
        mounted.current &&
        currentUserId.current === target.userId
      ) {
        toast({
          title: "Read status wasn't confirmed",
          description:
            "The update can still be opened. Retry marking it read in Notifications.",
          variant: "destructive",
        });
      }
    },
  });

  // Mutation cache ownership survives a header remount but stays account
  // scoped. This is transient retry feedback, not an offline write queue.
  const actions = useMutationState({
    filters: { mutationKey, exact: true },
    select: (entry) => ({
      id: entry.mutationId,
      status: entry.state.status,
      target: entry.state.variables as ReadTarget | undefined,
    }),
  });
  const latestAction = actions.reduce<(typeof actions)[number] | undefined>(
    (latest, entry) => (!latest || entry.id > latest.id ? entry : latest),
    undefined
  );
  const pending = actions.find((entry) => entry.status === "pending");
  const failedTarget =
    latestAction?.status === "error" ? latestAction.target : undefined;
  const readError =
    failedTarget &&
    (query.data === undefined ||
      query.data.some(
        (item) =>
          failedTarget.notificationIds.includes(item.id) && !item.read_at
      ))
      ? failedTarget
      : undefined;

  const markRead = (notificationId: string | null) => {
    if (
      !userId ||
      currentUserId.current !== userId ||
      queryClient.isMutating({ mutationKey, exact: true }) > 0
    )
      return;
    mutation.mutate({
      userId,
      notificationId,
      notificationIds: notificationId
        ? [notificationId]
        : (query.data ?? [])
            .filter((item) => !item.read_at)
            .map((item) => item.id),
    });
  };

  return {
    userId,
    query,
    notifications: query.data ?? [],
    hasData: query.data !== undefined,
    unread: query.data?.filter((item) => !item.read_at).length ?? 0,
    pendingRead: pending?.target,
    readError,
    readSucceeded: latestAction?.status === "success",
    markRead,
  };
};
