import { useState } from "react";
import { EMPTY_STATE_ASSETS, type EmptyStateAssetKey } from "@/config/emptyStateAssets";
import { APP_ICONS, type AppIcon as AppIconType } from "@/config/iconography";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/utils";

type EmptyStateIllustrationSize = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<EmptyStateIllustrationSize, string> = {
  sm: "h-20 w-28",
  md: "h-28 w-40",
  lg: "h-36 w-52",
  xl: "h-44 w-64",
};

interface EmptyStateIllustrationProps {
  asset: EmptyStateAssetKey;
  alt?: string;
  size?: EmptyStateIllustrationSize;
  className?: string;
  fallbackIcon?: AppIconType;
}

export const EmptyStateIllustration = ({
  asset,
  alt = "",
  size = "lg",
  className,
  fallbackIcon = APP_ICONS.library.emptyResults,
}: EmptyStateIllustrationProps) => {
  const src = EMPTY_STATE_ASSETS[asset];
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={cn(
        "empty-state-illustration relative mx-auto flex shrink-0 items-center justify-center",
        sizeClasses[size],
        className,
      )}
    >
      <span className="empty-state-illustration-halo" aria-hidden="true" />
      {failed ? (
        <span className="text-muted-foreground">
          <AppIcon icon={fallbackIcon} variant="empty" size={size === "sm" ? "lg" : "xl"} />
        </span>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="relative z-10 h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};
