import { ReactNode } from "react";
import { MobileBottomNav } from "./MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { Navbar } from "./Navbar";

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

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Navigation */}
      {!isMobile && showTopNav && <Navbar />}
      
      {/* Main Content */}
      <main className={cn(
        "w-full",
        isMobile && showBottomNav && "pb-16"
      )}>
        {children}
      </main>
      
      {/* Mobile Bottom Navigation */}
      {isMobile && showBottomNav && <MobileBottomNav />}
    </div>
  );
};

// Helper to avoid import issues
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
