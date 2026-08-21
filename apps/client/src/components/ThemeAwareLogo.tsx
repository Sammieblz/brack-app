import { cn } from "@/lib/utils";
import { BRACK_LOGO_IMAGES } from "@/config/brackAssets";

interface ThemeAwareLogoProps {
  /** "icon" = standalone icon mark, "full" = icon + "BRACK" text */
  variant: "icon" | "full";
  /** Tailwind size class applied to the logo (e.g. "h-16 w-16") */
  size?: string;
  className?: string;
}

export const ThemeAwareLogo = ({
  variant,
  size,
  className,
}: ThemeAwareLogoProps) => {
  const defaultSize = variant === "icon" ? "h-16 w-16" : "h-12 md:h-14";
  const maskSrc = BRACK_LOGO_IMAGES[variant];
  const maskSize = variant === "icon" ? "130%" : "100% auto";

  return (
    <span
      role="img"
      aria-label="Brack"
      className={cn(
        "inline-block shrink-0 select-none",
        variant === "icon" ? "aspect-square" : "aspect-[418/123]",
        size || defaultSize,
        className
      )}
      style={{
        background: "var(--gradient-primary)",
        WebkitMaskImage: `url(${maskSrc})`,
        maskImage: `url(${maskSrc})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: maskSize,
        maskSize,
      }}
    />
  );
};
