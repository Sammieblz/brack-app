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
}

const JourneyTab = forwardRef<HTMLButtonElement, JourneyTabProps>(({
  value,
  icon,
  currency,
  label,
}, ref) => (
  <TabsTrigger
    ref={ref}
    value={value}
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

export const JourneyTabsRail = ({ activeTab }: { activeTab: JourneyTabValue }) => {
  const tabRefs = useRef<Partial<Record<JourneyTabValue, HTMLButtonElement | null>>>({});

  useEffect(() => {
    tabRefs.current[activeTab]?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [activeTab]);

  return (
    <div className="w-full overflow-x-auto rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <TabsList
        className="flex h-auto min-w-full w-max justify-start gap-1 overflow-visible rounded-xl border border-border/70 bg-card/90 p-1.5"
        aria-label="Reader Journey sections"
      >
        {JOURNEY_TABS.map((tab) => (
          <JourneyTab
            key={tab.value}
            ref={(node) => { tabRefs.current[tab.value] = node; }}
            {...tab}
          />
        ))}
      </TabsList>
    </div>
  );
};
