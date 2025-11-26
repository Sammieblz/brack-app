import { ReactNode } from "react";
import { ArrowLeft, MessageCircle, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConversations } from "@/hooks/useConversations";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  action?: ReactNode;
  className?: string;
  hideMessaging?: boolean;
}

export const MobileHeader = ({ 
  title, 
  showBack = false, 
  action,
  className,
  hideMessaging = false
}: MobileHeaderProps) => {
  const navigate = useNavigate();
  const { conversations } = useConversations();
  const { triggerHaptic } = useHapticFeedback();
  
  const unreadCount = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);

  const handleMessagesClick = () => {
    triggerHaptic("selection");
    navigate("/messages");
  };

  const handleFeedClick = () => {
    triggerHaptic("selection");
    navigate("/feed");
  };

  return (
    <header className={cn(
      "sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shrink-0",
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
          <h1 className="text-lg font-semibold truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {!hideMessaging && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleFeedClick}
                className="relative"
                aria-label="Open social feed"
              >
                <Users className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleMessagesClick}
                className="relative"
                aria-label="Open messages"
              >
                <MessageCircle className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px]"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </>
          )}
          {action}
        </div>
      </div>
    </header>
  );
};
