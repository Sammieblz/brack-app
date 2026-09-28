import { Link, useLocation } from "react-router-dom";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { getMobileNavItems, isNavItemActive } from "@/config/navigation";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

export const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const { triggerHaptic } = useHapticFeedback();
  const { socialEnabled } = useFeatureFlags();

  return (
    <nav aria-label="Primary navigation" className="app-bottom-navigation">
      {getMobileNavItems(socialEnabled).map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.path} to={item.path} onClick={() => triggerHaptic("selection")}
            aria-current={isNavItemActive(pathname, item) ? "page" : undefined}>
            <span className="app-bottom-navigation-icon"><Icon aria-hidden="true" /></span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
