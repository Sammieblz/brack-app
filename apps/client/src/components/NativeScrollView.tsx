import { ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { usePlatform } from "@/hooks/usePlatform";

interface NativeScrollViewProps {
  children: ReactNode;
  className?: string;
  id?: string;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  scrollable?: boolean;
}

export const NativeScrollView = forwardRef<HTMLDivElement, NativeScrollViewProps>(
  ({ children, className, id, onScroll, scrollable = false }, ref) => {
    const { isIOS, isAndroid } = usePlatform();

    return (
      <div
        ref={ref}
        id={id}
        onScroll={onScroll}
        className={cn(
          scrollable
            ? "min-h-full touch-pan-y overflow-y-auto overflow-x-hidden overscroll-y-auto"
            : "min-h-0 w-full overflow-visible",
          // iOS rubber band effect
          scrollable && isIOS && "[-webkit-overflow-scrolling:touch]",
          // Android overscroll glow
          scrollable && isAndroid && "[overscroll-behavior:contain]",
          className
        )}
        style={{
          ...(scrollable
            ? {
                WebkitOverflowScrolling: "touch",
                scrollBehavior: "smooth",
              }
            : undefined),
        }}
      >
        {children}
      </div>
    );
  }
);

NativeScrollView.displayName = "NativeScrollView";
