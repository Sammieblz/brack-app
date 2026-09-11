import { forwardRef, useEffect, useRef } from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppIcon } from "@/components/ui/app-icon";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { APP_ICONS, type AppIcon as AppIconType } from "@/config/iconography";
import type { JourneyTabValue } from "@/lib/journey";
import { cn } from "@/lib/utils";

const JOURNEY_TABS: Array<{
  value: JourneyTabValue;
  label: string;
  icon?: AppIconType;
  currency?: "goldLeaves";
}> = [
  { value: "overview", label: "Overview", icon: APP_ICONS.journey.overview },
  { value: "quests", label: "Quests", icon: APP_ICONS.journey.quests },
  { value: "shop", label: "Shop", currency: "goldLeaves" },
  { value: "badges", label: "Badges", icon: APP_ICONS.journey.badges },
  { value: "rankings", label: "League", icon: APP_ICONS.journey.rankings },
];

interface JourneyTabProps {
  value: JourneyTabValue;
  icon?: AppIconType;
  currency?: "goldLeaves";
  label: string;
  disabled?: boolean;
}

const JourneyTab = forwardRef<HTMLButtonElement, JourneyTabProps>(({
  value,
  icon,
  currency,
  label,
  disabled,
}, ref) => (
  <TabsTrigger
    ref={ref}
    value={value}
    disabled={disabled}
    className={cn(
      "min-h-11 shrink-0 gap-2 rounded-lg px-3 text-sm",
      "data-[state=active]:bg-background data-[state=active]:shadow-sm",
    )}
    style={{ flex: "0 0 auto" }}
    aria-label={label}
  >
    {currency ? (
      <CurrencyIcon currency={currency} size="md" />
    ) : icon ? (
      <AppIcon icon={icon} variant="inline" />
    ) : null}
    <span>{label}</span>
  </TabsTrigger>
));

JourneyTab.displayName = "JourneyTab";

export const JourneyTabsRail = ({ activeTab, disabled = false }: {
  activeTab: JourneyTabValue;
  disabled?: boolean;
}) => {
  const railRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<JourneyTabValue, HTMLButtonElement | null>>>({});

  useEffect(() => {
    const rail = railRef.current;
    const tab = tabRefs.current[activeTab];
    if (!rail || !tab) return;

    // scrollIntoView also scrolls vertical ancestors, including the page. Only
    // reveal a clipped tab in this horizontal rail; keyboard changes are instant.
    const railBounds = rail.getBoundingClientRect();
    const tabBounds = tab.getBoundingClientRect();
    if (tabBounds.left >= railBounds.left && tabBounds.right <= railBounds.right) return;
    const left = rail.scrollLeft + (tabBounds.left - railBounds.left)
      - (rail.clientWidth - tabBounds.width) / 2;
    rail.scrollTo({
      left: Math.max(0, Math.min(left, rail.scrollWidth - rail.clientWidth)),
      behavior: "auto",
    });
  }, [activeTab]);

  return (
    <div ref={railRef} className="w-full overflow-x-auto rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <TabsList
        className="flex h-auto min-w-full w-max justify-start gap-1 overflow-visible rounded-xl border border-border/70 bg-card/90 p-1.5"
        aria-label="Reader Journey sections"
      >
        {JOURNEY_TABS.map((tab) => (
          <JourneyTab
            key={tab.value}
            ref={(node) => { tabRefs.current[tab.value] = node; }}
            {...tab}
            disabled={disabled}
          />
        ))}
      </TabsList>
    </div>
  );
};
