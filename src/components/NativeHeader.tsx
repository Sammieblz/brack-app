import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChatBubble, Search } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { HeaderTimerWidget } from "@/components/HeaderTimerWidget";
import { cn } from "@/lib/utils";

interface NativeHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  scrollContainerId?: string;
  showUtilityActions?: boolean;
}

const HeaderUtilityActions = () => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => navigate("/my-books")}
        className="hidden min-w-[210px] justify-start rounded-full border-border/70 bg-card/45 px-4 text-muted-foreground shadow-none hover:bg-accent hover:text-foreground xl:inline-flex"
        title="Search library"
      >
        <Search className="h-4 w-4" />
        <span className="font-normal">Search library</span>
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => navigate("/my-books")}
        className="rounded-full border-border/70 bg-card/45 shadow-none hover:bg-accent xl:hidden"
        aria-label="Search library"
        title="Search library"
      >
        <Search className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => navigate("/messages")}
        className="rounded-full border-border/70 bg-card/45 shadow-none hover:bg-accent"
        aria-label="Open messages"
        title="Messages"
      >
        <ChatBubble className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => navigate("/settings?section=notifications")}
        className="rounded-full border-border/70 bg-card/45 shadow-none hover:bg-accent"
        aria-label="Open notification settings"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
      </Button>
    </div>
  );
};

export const NativeHeader = ({
  title,
  subtitle,
  action,
  scrollContainerId,
  showUtilityActions = false,
}: NativeHeaderProps) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!scrollContainerId) return;

    const container = document.getElementById(scrollContainerId);
    if (!container) return;

    const handleScroll = () => {
      setIsScrolled(container.scrollTop > 50);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [scrollContainerId]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300 bg-background/95 backdrop-blur-md border-b",
        isScrolled ? "border-border shadow-sm" : "border-transparent"
      )}
    >
      <div
        className={cn(
          "app-page-header transition-all duration-300 flex items-end justify-between gap-4",
          isScrolled ? "py-3" : "py-6 pb-4"
        )}
      >
        <div className="flex-1 min-w-0">
          <h1
            className={cn(
              "font-display font-bold text-foreground transition-all duration-300 truncate",
              isScrolled ? "text-xl" : "text-3xl sm:text-4xl"
            )}
          >
            {title}
          </h1>
          {subtitle && !isScrolled && (
            <p className="font-sans text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {(showUtilityActions || action) && (
          <div className="flex flex-shrink-0 items-center justify-end gap-2">
            <HeaderTimerWidget />
            {showUtilityActions && <HeaderUtilityActions />}
            {action}
          </div>
        )}
      </div>
    </header>
  );
};
