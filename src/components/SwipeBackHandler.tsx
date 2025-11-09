import { ReactNode } from 'react';
import { useSwipeBack } from '@/hooks/useSwipeBack';
import { cn } from '@/lib/utils';

interface SwipeBackHandlerProps {
  children: ReactNode;
  enabled?: boolean;
  className?: string;
}

export const SwipeBackHandler = ({ 
  children, 
  enabled = true,
  className 
}: SwipeBackHandlerProps) => {
  const { isSwiping, swipeDistance } = useSwipeBack(enabled);

  // Calculate parallax effect
  // Current page slides out fully, previous page slides in slightly (30% parallax)
  const currentPageTransform = isSwiping ? `translateX(${swipeDistance}px)` : 'translateX(0)';
  const previousPageTransform = isSwiping 
    ? `translateX(${-30 + (swipeDistance / window.innerWidth) * 30}%)` 
    : 'translateX(-30%)';
  
  const shadowOpacity = isSwiping 
    ? Math.max(0, 1 - (swipeDistance / window.innerWidth))
    : 1;

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      {/* Previous page hint (parallax background) */}
      {isSwiping && (
        <div 
          className="absolute inset-0 bg-background"
          style={{
            transform: previousPageTransform,
            transition: swipeDistance === 0 ? 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)' : 'none',
          }}
        >
          {/* Placeholder for previous page - just shows background */}
          <div className="h-full w-full bg-gradient-to-r from-muted/20 to-background" />
        </div>
      )}

      {/* Current page */}
      <div
        className={cn(
          "relative h-full w-full bg-background",
          isSwiping && "will-change-transform"
        )}
        style={{
          transform: currentPageTransform,
          transition: swipeDistance === 0 ? 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)' : 'none',
          boxShadow: isSwiping ? `rgba(0, 0, 0, ${shadowOpacity * 0.3}) -2px 0px 8px` : 'none',
        }}
      >
        {children}
      </div>

      {/* Swipe indicator at left edge */}
      {isSwiping && swipeDistance > 10 && (
        <div 
          className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-50"
          style={{
            opacity: Math.min(1, swipeDistance / 100),
            transition: 'opacity 0.1s',
          }}
        >
          <div className="bg-primary/20 backdrop-blur-sm rounded-full p-2">
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              className="text-primary"
            >
              <path 
                d="M15 18l-6-6 6-6" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};
