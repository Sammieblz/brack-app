import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { BRACK_LOGO_IMAGES } from "@/config/brackAssets";

interface ThemeAwareLogoProps {
  /** "icon" = standalone icon mark, "full" = icon + "BRACK" text */
  variant: "icon" | "full";
  /** Tailwind size class applied to the logo (e.g. "h-16 w-16") */
  size?: string;
  className?: string;
  /** Optional override: when true forces the orange-text full logo regardless of theme */
  useOrange?: boolean;
  /** "adaptive" swaps logo files for light/dark. "theme" tints the mark with the active app color theme. */
  tone?: "adaptive" | "theme";
}

export const ThemeAwareLogo = ({
  variant,
  size,
  className,
  useOrange = false,
  tone = "adaptive",
}: ThemeAwareLogoProps) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const defaultSize = variant === "icon" ? "h-16 w-16" : "h-12 md:h-14";

  if (tone === "theme") {
    const maskSrc = variant === "icon" ? BRACK_LOGO_IMAGES.icon.mask : BRACK_LOGO_IMAGES.full.mask;
    const maskSize = variant === "icon" ? "130%" : "contain";

    return (
      <span
        role="img"
        aria-label="Brack"
        className={cn(
          "inline-block shrink-0 select-none",
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
  }

  let src: string;
  if (variant === "full" && useOrange) {
    src = BRACK_LOGO_IMAGES.full.orange;
  } else if (variant === "full") {
    src = isDark ? BRACK_LOGO_IMAGES.full.dark : BRACK_LOGO_IMAGES.full.light;
  } else {
    src = isDark ? BRACK_LOGO_IMAGES.icon.dark : BRACK_LOGO_IMAGES.icon.light;
  }

  return (
    <img
      src={src}
      alt="Brack"
      className={cn(
        "object-contain select-none",
        size || defaultSize,
        className
      )}
      draggable={false}
    />
  );
};
