import { ReactNode, useRef } from "react";
import { MobileBottomNav } from "./MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { Navbar } from "./Navbar";
import { useNativeApp } from "@/hooks/useNativeApp";
import { usePersistentScrollPosition } from "@/hooks/useScrollPosition";
import { useLocation } from "react-router-dom";

interface MobileLayoutProps {
  children: ReactNode;
  showBottomNav?: boolean;
  showTopNav?: boolean;
}

export const MobileLayout = ({ 
  children, 
  showBottomNav = true,
  showTopNav = true 
}: MobileLayoutProps) => {
  const isMobile = useIsMobile();
  const isNative = useNativeApp();
  const location = useLocation();
  const scrollRef = usePersistentScrollPosition(location.pathname);

  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        {/* Main Content - Scrollable */}
        <main
          ref={scrollRef as React.RefObject<HTMLElement>}
          className={`flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch] ${
            isNative ? "safe-top safe-bottom" : ""
          } pb-28`}
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 104px)" }}
        >
          {children}
        </main>
        
        {/* Mobile Bottom Navigation */}
        {showBottomNav && <MobileBottomNav />}
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="min-h-screen bg-background">
      {showTopNav && <Navbar />}
      <main className="w-full">
        {children}
      </main>
    </div>
  );
};

// Helper to avoid import issues
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
