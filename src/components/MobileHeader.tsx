import { ReactNode, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  action?: ReactNode;
  className?: string;
}

export const MobileHeader = ({ 
  title, 
  showBack = false, 
  action,
  className
}: MobileHeaderProps) => {
  const navigate = useNavigate();
  const { triggerHaptic } = useHapticFeedback();
  const { profile, isLoading: profileLoading } = useProfileContext();
  const isMobile = useIsMobile();
  const { isSwiping } = useSwipeBack(isMobile && showBack);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Determine if we should show avatar (root-level pages without back button)
  const showAvatar = !showBack && isMobile;
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
      <header className={cn(
        "sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shrink-0",
        isSwiping && "transition-transform duration-300",
        className
      )}>
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {showBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="shrink-0"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <h1 className="font-display text-lg font-semibold truncate">{title}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {action}
            {showAvatar && (
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
                {profileLoading ? (
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                ) : (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                    <AvatarFallback name={displayName} className="text-xs">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                )}
              </Button>
            )}
          </div>
        </div>
    </header>
    <ProfileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
};
