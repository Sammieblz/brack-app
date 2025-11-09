import { ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { usePlatform } from "@/hooks/usePlatform";

interface NativeScrollViewProps {
  children: ReactNode;
  className?: string;
  id?: string;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export const NativeScrollView = forwardRef<HTMLDivElement, NativeScrollViewProps>(
  ({ children, className, id, onScroll }, ref) => {
    const { isIOS, isAndroid } = usePlatform();

    return (
      <div
        ref={ref}
        id={id}
        onScroll={onScroll}
        className={cn(
          "overflow-y-auto overscroll-y-contain",
          // iOS rubber band effect
          isIOS && "[-webkit-overflow-scrolling:touch]",
          // Android overscroll glow
          isAndroid && "[overscroll-behavior:contain]",
          className
        )}
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
        }}
      >
        {children}
      </div>
    );
  }
);

NativeScrollView.displayName = "NativeScrollView";
