import type { ReactNode } from "react";
import { EmptyStateIllustration } from "@/components/empty/EmptyStateIllustration";
import type { EmptyStateAssetKey } from "@/config/emptyStateAssets";
import type { AppIcon as AppIconType } from "@/config/iconography";
import { cn } from "@/lib/utils";

interface PremiumEmptyStateProps {
  asset: EmptyStateAssetKey;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  variant?: "card" | "plain";
  size?: "compact" | "default" | "large";
  className?: string;
  illustrationClassName?: string;
  fallbackIcon?: AppIconType;
}

const minHeightClasses = {
  compact: "min-h-[12rem]",
  default: "min-h-[18rem]",
  large: "min-h-[22rem]",
};

const imageSize = {
  compact: "md",
  default: "lg",
  large: "xl",
} as const;

export const PremiumEmptyState = ({
  asset,
  title,
  description,
  action,
  variant = "card",
  size = "default",
  className,
  illustrationClassName,
  fallbackIcon,
}: PremiumEmptyStateProps) => (
  <div
    className={cn(
      "premium-empty-state flex flex-col items-center justify-center overflow-hidden p-6 text-center sm:p-8",
      minHeightClasses[size],
      variant === "card" && "rounded-lg border border-border/70 bg-card/80 shadow-sm",
      variant === "plain" && "bg-transparent",
      className,
    )}
  >
    <EmptyStateIllustration
      asset={asset}
      size={imageSize[size]}
      className={cn("mb-4", illustrationClassName)}
      fallbackIcon={fallbackIcon}
    />
    <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
    {description && (
      <div className="mt-2 max-w-md font-sans text-sm leading-6 text-muted-foreground">
        {description}
      </div>
    )}
    {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
  </div>
);
