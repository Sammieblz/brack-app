import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { 
  User, 
  Target, 
  BarChart3, 
  Award, 
  MessageCircle, 
  BookOpen, 
  List, 
  Settings, 
  LogOut,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  badge?: number;
}

export const ProfileDrawer = ({ open, onOpenChange }: ProfileDrawerProps) => {
  const navigate = useNavigate();
  const { profile, isLoading } = useProfileContext();
  const { user, signOut } = useAuth();
  const { followersCount, followingCount } = useFollowing(user?.id || null);
  const { conversations } = useConversations();
  const { triggerHaptic } = useHapticFeedback();
  
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

  const menuItems: MenuItem[] = [
    { label: "Profile", icon: User, path: "/profile" },
    { label: "Goals", icon: Target, path: "/goals-management" },
    { label: "Analytics", icon: BarChart3, path: "/analytics" },
    { label: "Achievements", icon: Award, path: "/achievements" },
    { label: "Messages", icon: MessageCircle, path: "/messages", badge: unreadCount > 0 ? unreadCount : undefined },
    { label: "Book Clubs", icon: Users, path: "/clubs" },
    { label: "Lists", icon: List, path: "/lists" },
    { label: "Settings", icon: Settings, path: "/settings" },
  ];

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
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  data-menu-item
                  onClick={() => handleMenuItemClick(item.path)}
                  className={cn(
                    "w-full flex items-center gap-3 px-6 py-3 text-left transition-colors",
                    "hover:bg-muted/50 active:bg-muted",
                    "focus:outline-none focus:bg-muted/50"
                  )}
                >
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="font-sans flex-1 font-medium text-foreground">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="h-5 min-w-5 flex items-center justify-center px-1.5 text-xs"
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </Badge>
                  )}
                </button>
              );
            })}
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
