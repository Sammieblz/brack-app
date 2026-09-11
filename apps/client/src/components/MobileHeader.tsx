import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProfileContext } from "@/contexts/ProfileContext";
import { ProfileDrawer } from "@/components/ProfileDrawer";
import { useSwipeToOpenDrawer } from "@/hooks/useSwipeToOpenDrawer";
import { getInitials } from "@/lib/avatarUtils";
import { cn } from "@/lib/utils";
import { AppBackButton } from "@/components/AppBackButton";
import type { BackButtonConfig } from "@/hooks/useAppBack";
import { UserNotificationsPopover } from "@/components/UserNotificationsPopover";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingRegion } from "@/components/loading/LoadingRegion";
import { useAppHeader } from "@/hooks/useAppHeader";

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  back?: BackButtonConfig;
  action?: ReactNode;
  secondary?: ReactNode;
  className?: string;
}

export const MobileHeader = ({ 
  title, 
  showBack = false, 
  back,
  action,
  secondary,
  className
}: MobileHeaderProps) => {
  const headerRef = useAppHeader();
  const { triggerHaptic } = useHapticFeedback();
  const { profile, isLoading: profileLoading } = useProfileContext();
  const isMobile = useIsMobile();
  const backConfig = back ?? (showBack ? {} : undefined);
  const hasBack = Boolean(backConfig);
  const { isSwiping } = useSwipeBack(isMobile && hasBack && !backConfig?.onBack && !backConfig?.to);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Determine if we should show avatar (root-level pages without back button)
  const showAvatar = !hasBack && isMobile;
  const displayName = profile?.display_name || 'User';

  // Enable swipe-to-open drawer only on root-level pages (when avatar is shown)
  useSwipeToOpenDrawer({
    onSwipeOpen: () => {
      triggerHaptic("selection");
      setDrawerOpen(true);
    },
    enabled: showAvatar,
  });

  return (
    <>
      <header ref={headerRef} className={cn(
        "sticky top-0 z-50 bg-background/95 pt-[var(--app-safe-top,0px)] backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shrink-0",
        isSwiping && "transition-transform duration-300",
        className
      )}>
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {backConfig && (
              <AppBackButton
                {...backConfig}
                className="-ml-2 h-10 w-10"
                ariaLabel={backConfig.ariaLabel ?? "Go back"}
              />
            )}
            <h1 className="font-display text-lg font-semibold truncate">{title}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {action}
            {showAvatar && (
              <>
                <UserNotificationsPopover />
                <LoadingRegion loading={profileLoading && !profile} label="Loading profile photo" containerClassName="shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    triggerHaptic("selection");
                    setDrawerOpen(true);
                  }}
                  className="shrink-0"
                  aria-label="Open profile menu"
                >
                  {profileLoading && !profile ? (
                    <Skeleton className="h-8 w-8 rounded-full" />
                  ) : (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                      <AvatarFallback name={displayName} className="text-xs">
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </Button>
                </LoadingRegion>
              </>
            )}
          </div>
        </div>
        {secondary && (
          <div
            className="border-t border-border/60 pb-2 pt-2"
            style={{
              paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
              paddingRight: "max(0.75rem, env(safe-area-inset-right))",
            }}
          >
            {secondary}
          </div>
        )}
    </header>
    <ProfileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
};
