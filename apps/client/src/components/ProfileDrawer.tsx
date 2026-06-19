import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useAuth } from "@/hooks/useAuth";
import { useFollowing } from "@/hooks/useFollowing";
import { useConversations } from "@/hooks/useConversations";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useGSAPTimeline } from "@/hooks/useGSAP";
import { gsap } from "gsap";
import { getInitials } from "@/lib/avatarUtils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { User, LogOut } from "iconoir-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, getNavItemsBySection, isNavItemActive, type NavItem } from "@/config/navigation";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

interface ProfileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfileDrawer = ({ open, onOpenChange }: ProfileDrawerProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, isLoading } = useProfileContext();
  const { user, signOut } = useAuth();
  const { followersCount, followingCount } = useFollowing(user?.id || null);
  const { conversations } = useConversations();
  const { triggerHaptic } = useHapticFeedback();
  const { socialEnabled } = useFeatureFlags();
  
  const menuItemsRef = useRef<HTMLDivElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Get unread messages count
  const unreadCount = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // GSAP animations for menu items
  useGSAPTimeline(
    (tl) => {
      if (!open || prefersReducedMotion || !menuItemsRef.current) return;

      const items = menuItemsRef.current.querySelectorAll('[data-menu-item]');
      gsap.set(items, { opacity: 0, y: 10 });
      
      tl.to(items, {
        opacity: 1,
        y: 0,
        duration: 0.3,
        ease: "power2.out",
        stagger: 0.05,
      });
    },
    { dependencies: [open, prefersReducedMotion] }
  );

  const getBadge = (item: NavItem) =>
    item.path === "/messages" && unreadCount > 0 ? unreadCount : undefined;

  const drawerGroups = NAV_GROUPS
    .map((group) => ({
      ...group,
      items: getNavItemsBySection(group.section, socialEnabled),
    }))
    .filter((group) => group.items.length > 0);

  const accountItems = getNavItemsBySection("account", socialEnabled);

  const handleMenuItemClick = (path: string) => {
    triggerHaptic("selection");
    navigate(path);
    onOpenChange(false);
  };

  const handleSignOut = async () => {
    triggerHaptic("impact");
    await signOut();
    navigate("/");
    onOpenChange(false);
  };

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const email = user?.email || '';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-[280px] sm:w-[320px] p-0 overflow-y-auto safe-top safe-bottom"
      >
        <div className="flex flex-col h-full">
          {/* Header Section */}
          <div className="p-6 border-b border-border">
            {isLoading ? (
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                  <AvatarFallback name={displayName}>
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-sans font-semibold text-foreground truncate">{displayName}</p>
                  <p className="font-sans text-sm text-muted-foreground truncate">{email}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="font-sans">{followingCount} Following</span>
                    <span className="font-sans">{followersCount} Followers</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div ref={menuItemsRef} className="flex-1 py-4">
            <div className="px-3 pb-2">
              <button
                data-menu-item
                onClick={() => handleMenuItemClick("/profile")}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors",
                  "hover:bg-muted/50 active:bg-muted focus:outline-none focus:bg-muted/50",
                  location.pathname === "/profile" && "bg-primary/10 text-primary"
                )}
              >
                <User className={cn("h-5 w-5", location.pathname === "/profile" ? "text-primary" : "text-muted-foreground")} />
                <span className="font-sans flex-1 font-medium">Profile</span>
              </button>
            </div>

            {drawerGroups.map((group) => (
              <div key={group.section} className="px-3 py-2">
                <div className="px-3 pb-1.5 font-sans text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isNavItemActive(location.pathname, item);
                    const badge = getBadge(item);

                    return (
                      <button
                        key={item.path}
                        data-menu-item
                        onClick={() => handleMenuItemClick(item.path)}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                          "hover:bg-muted/50 active:bg-muted focus:outline-none focus:bg-muted/50",
                          active && "bg-primary/10 text-primary"
                        )}
                      >
                        <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                        <span className="font-sans flex-1 font-medium">{item.label}</span>
                        {badge !== undefined && badge > 0 && (
                          <Badge
                            variant="destructive"
                            className="h-5 min-w-5 flex items-center justify-center px-1.5 text-xs"
                          >
                            {badge > 9 ? "9+" : badge}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {accountItems.length > 0 && (
              <div className="px-3 py-2">
                <div className="px-3 pb-1.5 font-sans text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Account
                </div>
                <div className="space-y-1">
                  {accountItems.map((item) => {
                    const Icon = item.icon;
                    const active = isNavItemActive(location.pathname, item);

                    return (
                      <button
                        key={item.path}
                        data-menu-item
                        onClick={() => handleMenuItemClick(item.path)}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                          "hover:bg-muted/50 active:bg-muted focus:outline-none focus:bg-muted/50",
                          active && "bg-primary/10 text-primary"
                        )}
                      >
                        <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                        <span className="font-sans flex-1 font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Footer Section */}
          <div className="p-6 space-y-4">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between">
              <span className="font-sans text-sm text-muted-foreground">Theme</span>
              <ThemeToggle variant="inline" />
            </div>

            {/* Sign Out */}
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sign Out
            </Button>

            {/* App Version */}
            <p className="font-sans text-xs text-center text-muted-foreground">
              v2.1.0
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
