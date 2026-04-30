import { ReactNode } from "react";
import { MobileBottomNav } from "./MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
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

  if (!showTopNav) {
    return (
      <div className="h-screen bg-background overflow-hidden">
        <main
          ref={scrollRef as React.RefObject<HTMLElement>}
          className="h-full overflow-y-auto overflow-x-hidden"
        >
          {children}
        </main>
      </div>
    );
  }

  // Tablet and desktop layout
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset className="h-screen min-h-0 overflow-hidden">
        <main
          ref={scrollRef as React.RefObject<HTMLElement>}
          className="h-full overflow-y-auto overflow-x-hidden bg-gradient-background"
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};
