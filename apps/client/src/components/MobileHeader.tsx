import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppBackButton } from "@/components/AppBackButton";
import type { BackButtonConfig } from "@/hooks/useAppBack";
import { UserNotificationsPopover } from "@/components/UserNotificationsPopover";
import { useAppHeader } from "@/hooks/useAppHeader";
import { ShellNavigationTrigger } from "@/components/ShellNavigation";

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  back?: BackButtonConfig;
  action?: ReactNode;
  secondary?: ReactNode;
  className?: string;
}

export const MobileHeader = ({ title, showBack = false, back, action, secondary, className }: MobileHeaderProps) => {
  const headerRef = useAppHeader();
  const backConfig = back ?? (showBack ? {} : undefined);
  return (
    <header ref={headerRef} className={cn(
      "sticky top-0 z-50 border-b border-border bg-background pt-[var(--app-safe-top,0px)] shrink-0", className
    )}>
      <div className="flex min-h-14 flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2"
        style={{ paddingLeft: "max(0.75rem, env(safe-area-inset-left))", paddingRight: "max(0.75rem, env(safe-area-inset-right))" }}>
        <div className="flex min-w-0 flex-[1_1_8rem] items-center gap-1">
          {backConfig && <AppBackButton {...backConfig} className="h-11 w-11 shrink-0"
            ariaLabel={backConfig.ariaLabel ?? "Go back"} />}
          <h1 className="min-w-0 break-words font-display text-xl font-semibold">{title}</h1>
        </div>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1">
          {action}
          {!backConfig && <UserNotificationsPopover />}
          <ShellNavigationTrigger />
        </div>
      </div>
      {secondary && <div className="border-t border-border/60 py-2"
        style={{ paddingLeft: "max(0.75rem, env(safe-area-inset-left))", paddingRight: "max(0.75rem, env(safe-area-inset-right))" }}>
        {secondary}
      </div>}
    </header>
  );
};
