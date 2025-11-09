import { Home, BookOpen, Users, User, MessageCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useConversations } from "@/hooks/useConversations";
import { Badge } from "@/components/ui/badge";

const tabs = [
  { name: "Home", path: "/", icon: Home },
  { name: "Library", path: "/my-books", icon: BookOpen },
  { name: "Social", path: "/feed", icon: Users },
  { name: "Messages", path: "/messages", icon: MessageCircle },
  { name: "Profile", path: "/profile", icon: User },
];

export const MobileBottomNav = () => {
  const location = useLocation();
  const { triggerHaptic } = useHapticFeedback();
  const { conversations } = useConversations();
  
  const unreadCount = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          
          return (
            <Link
              key={tab.path}
              to={tab.path}
              onClick={() => triggerHaptic("selection")}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors touch-manipulation relative",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-6 w-6 mb-1", active && "fill-primary/20")} />
                {tab.name === "Messages" && unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium">{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
