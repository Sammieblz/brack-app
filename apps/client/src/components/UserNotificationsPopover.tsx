import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AppIcon } from "@/components/ui/app-icon";
import { CurrencyIcon, type BrackCurrency } from "@/components/CurrencyIcon";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { APP_ICONS } from "@/config/iconography";
import {
  getUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
  type GamificationNotification,
} from "@/services/api";

const notificationPath = (notification: GamificationNotification) => {
  if (
    notification.notification_type === "gold_leaves_earned"
    || notification.notification_type.includes("gold_leaf")
  ) {
    return "/achievements?tab=shop";
  }
  if (
    notification.notification_type.includes("league")
    || notification.notification_type === "rank_movement"
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
  notification: GamificationNotification,
): BrackCurrency | null => {
  if (
    notification.notification_type === "gold_leaves_earned"
    || notification.notification_type.includes("gold_leaf")
  ) {
    return "goldLeaves";
  }
  if (
    notification.notification_type === "level_up"
    || notification.notification_type.startsWith("quest_")
  ) {
    return "ink";
  }
  return null;
};

export const UserNotificationsPopover = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["user-notifications"],
    queryFn: getUserNotifications,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const unread = query.data?.filter((notification) => !notification.read_at).length ?? 0;

  const openNotification = async (notification: GamificationNotification) => {
    if (!notification.read_at) {
      await markUserNotificationRead(notification.id);
      await queryClient.invalidateQueries({ queryKey: ["user-notifications"] });
    }
    navigate(notificationPath(notification));
  };

  const markAllRead = async () => {
    await markAllUserNotificationsRead();
    await queryClient.invalidateQueries({ queryKey: ["user-notifications"] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative rounded-full border-border/70 bg-card/45 shadow-none hover:bg-accent"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          title="Notifications"
        >
          <AppIcon icon={APP_ICONS.settings.notifications} variant="action" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-border/70 p-3">
          <div>
            <p className="font-medium">Notifications</p>
            <p className="text-xs text-muted-foreground">{unread} unread</p>
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        {!query.data?.length ? (
          <PremiumEmptyState
            asset="syncReviewClear"
            title="You're caught up"
            description="Quest and Reader League updates will appear here."
            variant="plain"
            size="compact"
            className="p-4"
          />
        ) : (
          <div className="max-h-[28rem] overflow-y-auto p-2">
            {query.data.map((notification) => {
              const currency = notificationCurrency(notification);
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className="flex w-full items-start gap-3 rounded-md p-3 text-left transition-colors hover:bg-accent"
                >
                  {currency && (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <CurrencyIcon currency={currency} size="lg" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{notification.title}</span>
                      {!notification.read_at && <Badge className="h-2 w-2 rounded-full p-0" />}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {notification.body}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {new Date(notification.created_at).toLocaleString()}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
