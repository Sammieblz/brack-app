import { ReactNode } from "react";
import { MobileBottomNav } from "./MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useNativeApp } from "@/hooks/useNativeApp";
import { usePersistentScrollPosition } from "@/hooks/useScrollPosition";
import { useLocation } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";

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
      <div className="app-viewport flex flex-col overflow-hidden bg-background">
        {/* Main Content - Scrollable */}
        <main
          ref={scrollRef as React.RefObject<HTMLElement>}
          data-app-scroll-container="true"
          className={`app-scroll-container flex-1 ${
            isNative ? "safe-top safe-bottom" : ""
          } pb-28`}
          style={{
            paddingBottom: showBottomNav
              ? "max(env(safe-area-inset-bottom), 104px)"
              : "env(safe-area-inset-bottom)",
          }}
        >
          {children}
        </main>
        <ScrollToTop
          containerRef={scrollRef}
          hasBottomNav={showBottomNav}
          resetKey={location.pathname}
        />
        
        {/* Mobile Bottom Navigation */}
        {showBottomNav && <MobileBottomNav />}
      </div>
    );
  }

  if (!showTopNav) {
    return (
      <div className="app-viewport overflow-hidden bg-background">
        <main
          ref={scrollRef as React.RefObject<HTMLElement>}
          data-app-scroll-container="true"
          className="app-scroll-container h-full"
        >
          {children}
        </main>
        <ScrollToTop containerRef={scrollRef} resetKey={location.pathname} />
      </div>
    );
  }

  // Tablet and desktop layout
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset className="app-viewport min-h-0 min-w-0 overflow-hidden">
        <main
          ref={scrollRef as React.RefObject<HTMLElement>}
          data-app-scroll-container="true"
          className="app-scroll-container h-full bg-gradient-background"
        >
          {children}
        </main>
        <ScrollToTop containerRef={scrollRef} resetKey={location.pathname} />
      </SidebarInset>
    </SidebarProvider>
  );
};
