import { Home, BookOpen, Users, List, Radio } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

const tabs = [
  { name: "Home", path: "/", icon: Home },
  { name: "Library", path: "/my-books", icon: BookOpen },
  { name: "Discover", path: "/readers", icon: Users },
  { name: "Feed", path: "/feed", icon: Radio },
  { name: "Lists", path: "/lists", icon: List },
];

export const MobileBottomNav = () => {
  const location = useLocation();
  const { triggerHaptic } = useHapticFeedback();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="fixed inset-x-2 sm:inset-x-4 z-50 pointer-events-none"
      style={{ bottom: "max(env(safe-area-inset-bottom), 24px)" }}
    >
      <div className="relative pointer-events-auto px-2 sm:px-3 py-2">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/18 via-background/70 to-primary/22 opacity-95 blur-xl pointer-events-none rounded-[32px]" />
        <div className="absolute inset-0 rounded-[32px] border border-white/12 shadow-[0_14px_50px_rgba(0,0,0,0.45)] supports-[backdrop-filter]:backdrop-blur-2xl bg-background/75" />
        <div className="absolute inset-x-8 top-[16%] h-px bg-white/14 rounded-full pointer-events-none" />

        <div className="relative flex items-center justify-around h-[72px] max-w-4xl mx-auto gap-0.5 rounded-[28px] max-[400px]:h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          
          return (
            <Link
              key={tab.path}
              to={tab.path}
              onClick={() => triggerHaptic("selection")}
              className={cn(
                "relative flex min-w-0 flex-col items-center justify-center flex-1 h-full transition-all duration-200 touch-manipulation rounded-2xl px-2 sm:px-3 py-2 gap-1 text-[11px] sm:text-xs font-medium active:scale-95",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={`Navigate to ${tab.name}`}
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <span className="absolute inset-0 rounded-2xl bg-primary/12 shadow-inner shadow-primary/10 supports-[backdrop-filter]:backdrop-blur-md transition-all duration-200 animate-in fade-in" />
              )}
              <Icon className={cn(
                "h-5 w-5 sm:h-6 sm:w-6 z-10 transition-all duration-200",
                active && "stroke-[2.25] scale-110"
              )} />
              <span className={cn(
                "font-sans z-10 truncate transition-all duration-200",
                active && "font-semibold"
              )}>{tab.name}</span>
            </Link>
          );
        })}
      </div>
      </div>
    </nav>
  );
};
