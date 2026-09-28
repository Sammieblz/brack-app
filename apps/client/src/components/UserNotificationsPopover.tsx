import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AppIcon } from "@/components/ui/app-icon";
import { CurrencyIcon, type BrackCurrency } from "@/components/CurrencyIcon";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import {
  LoadingError,
  LoadingRegion,
} from "@/components/loading/LoadingRegion";
import { APP_ICONS } from "@/config/iconography";
import { useUserNotifications } from "@/hooks/useUserNotifications";
import type { GamificationNotification } from "@/services/api";

const notificationPath = (notification: GamificationNotification) => {
  if (
    notification.notification_type === "gold_leaves_earned" ||
    notification.notification_type.includes("gold_leaf")
  ) {
    return "/achievements?tab=shop";
  }
  if (
    notification.notification_type.includes("league") ||
    notification.notification_type === "rank_movement"
  ) {
    return "/achievements?tab=rankings";
  }
  if (notification.notification_type.startsWith("quest_")) {
    return "/achievements?tab=quests";
  }
  if (notification.notification_type === "badge_earned") {
    return "/achievements?tab=badges";
  }
  return "/achievements";
};

const notificationCurrency = (
  notification: GamificationNotification
): BrackCurrency | null => {
  if (
    notification.notification_type === "gold_leaves_earned" ||
    notification.notification_type.includes("gold_leaf")
  ) {
    return "goldLeaves";
  }
  if (
    notification.notification_type === "level_up" ||
    notification.notification_type.startsWith("quest_")
  ) {
    return "ink";
  }
  return null;
};

export const UserNotificationsPopover = () => {
  const navigate = useNavigate();
  const {
    userId,
    query,
    notifications,
    hasData,
    unread,
    pendingRead,
    readError,
    readSucceeded,
    markRead,
  } = useUserNotifications();
  const [open, setOpen] = useState(false);
  const navigating = useRef(false);
  const headingId = useId();
  const initialLoading = !hasData && query.isPending;
  const refreshing = hasData && query.isFetching;
  const waitingForConnection = query.fetchStatus === "paused";
  useEffect(() => {
    setOpen(false);
  }, [userId]);

  const openNotification = (notification: GamificationNotification) => {
    if (!notification.read_at) markRead(notification.id);
    navigating.current = true;
    setOpen(false);
    navigate(notificationPath(notification));
  };

  if (!userId) return null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) navigating.current = false;
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative min-h-11 min-w-11 rounded-full border-border/70 bg-card/45 shadow-none hover:bg-accent"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
          }
          title="Notifications"
        >
          <AppIcon icon={APP_ICONS.settings.notifications} variant="action" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-labelledby={headingId}
        className="flex max-h-[min(32rem,var(--radix-popover-content-available-height))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden p-0"
        onCloseAutoFocus={(event) => {
          // Preserve Radix trigger restoration for Close/Escape and its
          // outside-interaction behavior. Navigation owns its new focus.
          if (navigating.current) event.preventDefault();
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/70 p-3">
          <div>
            <h2 id={headingId} className="font-medium">
              Notifications
            </h2>
            {hasData && (
              <p className="text-xs text-muted-foreground">
                {unread} unread in this list
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
          <div className="flex w-full flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11"
              aria-label="Refresh notifications"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Refresh
            </Button>
            {notifications.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11"
                disabled={unread === 0 || Boolean(pendingRead)}
                onClick={() => markRead(null)}
              >
                {pendingRead?.notificationId === null
                  ? "Marking all read…"
                  : "Mark all read"}
              </Button>
            )}
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto p-2">
          {readError && (
            <div className="mb-2 rounded-lg border border-destructive/30 p-3">
              <p role="alert" className="text-sm">
                {readError.notificationId
                  ? "Could not confirm this notification's read status. Try again."
                  : "Could not confirm the notifications' read status. Try again."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 min-h-11"
                onClick={() => markRead(readError.notificationId)}
              >
                Retry marking read
              </Button>
            </div>
          )}
          <p
            role="status"
            aria-live="polite"
            className="px-2 text-sm text-muted-foreground"
          >
            {pendingRead
              ? pendingRead.notificationId
                ? "Marking notification as read…"
                : "Marking all notifications as read…"
              : readSucceeded
              ? "Read status updated."
              : ""}
          </p>
          {query.isError && (
            <LoadingError
              className="mb-2"
              message={
                hasData
                  ? "Notifications could not be refreshed. Your previous updates are still here."
                  : "Notifications could not be loaded."
              }
              onRetry={() => void query.refetch()}
            />
          )}
          {waitingForConnection && hasData && (
            <p role="status" className="p-2 text-sm text-muted-foreground">
              Waiting for a connection. Showing saved notifications.
            </p>
          )}
          <LoadingRegion
            loading={initialLoading}
            refreshing={refreshing}
            label={
              waitingForConnection
                ? "Waiting for a connection to load notifications."
                : "Loading notifications…"
            }
          >
            {initialLoading && (
              <p
                aria-hidden="true"
                className="p-4 text-sm text-muted-foreground"
              >
                {waitingForConnection
                  ? "Waiting for a connection…"
                  : "Loading notifications…"}
              </p>
            )}
            {query.isSuccess &&
            !query.isFetching &&
            !waitingForConnection &&
            notifications.length === 0 ? (
              <PremiumEmptyState
                asset="syncReviewClear"
                title="You're caught up"
                description="Quest and Reader League updates will appear here."
                variant="plain"
                size="compact"
                className="p-4"
              />
            ) : (
              <ul className="space-y-1" aria-label="Notification updates">
                {notifications.map((notification) => {
                  const currency = notificationCurrency(notification);
                  return (
                    <li key={notification.id}>
                      <button
                        type="button"
                        onClick={() => openNotification(notification)}
                        className="flex min-h-11 w-full items-start gap-3 rounded-md p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {currency && (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <CurrencyIcon currency={currency} size="lg" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="break-words text-sm font-medium">
                              {notification.title}
                            </span>
                            {!notification.read_at && (
                              <>
                                <Badge
                                  aria-hidden="true"
                                  className="h-2 w-2 shrink-0 rounded-full p-0"
                                />
                                <span className="sr-only">Unread</span>
                              </>
                            )}
                          </span>
                          <span className="mt-1 block text-sm text-muted-foreground">
                            {notification.body}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {new Date(notification.created_at).toLocaleString()}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </LoadingRegion>
        </div>
      </PopoverContent>
    </Popover>
  );
};
