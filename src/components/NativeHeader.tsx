import { ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { usePlatform } from "@/hooks/usePlatform";

interface NativeHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  scrollContainerId?: string;
}

export const NativeHeader = ({
  title,
  subtitle,
  action,
  scrollContainerId,
}: NativeHeaderProps) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const { isIOS } = usePlatform();

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
          "px-4 transition-all duration-300 flex items-end justify-between",
          isScrolled ? "py-3" : "py-6 pb-4"
        )}
      >
        <div className="flex-1 min-w-0">
          <h1
            className={cn(
              "font-bold text-foreground transition-all duration-300 truncate",
              isScrolled ? "text-xl" : "text-3xl sm:text-4xl"
            )}
          >
            {title}
          </h1>
          {subtitle && !isScrolled && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {action && <div className="ml-4 flex-shrink-0">{action}</div>}
      </div>
    </header>
  );
};
