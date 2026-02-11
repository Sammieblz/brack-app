import { useTheme as useNextTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface ThemeAwareLogoProps {
  /** "icon" = standalone icon mark, "full" = icon + "BRACK" text */
  variant: "icon" | "full";
  /** Tailwind size class applied to the img (e.g. "h-16 w-16") */
  size?: string;
  className?: string;
  /** Optional override – when true forces the "orange-text" full logo regardless of theme */
  useOrange?: boolean;
}

const logoMap = {
  icon: {
    light: "/brack-icon-transparent-bg-dark.png",   // dark icon on light bg
    dark: "/brack-icon-transparent-bg-light.png",    // light icon on dark bg
  },
  full: {
    light: "/brack-logo-transparent-bg-dark-text.png",
    dark: "/brack-logo-transparent-bg-white-text.png",
    orange: "/brack-logo-transparent-bg-orange-text.png",
  },
};

export const ThemeAwareLogo = ({
  variant,
  size,
  className,
  useOrange = false,
}: ThemeAwareLogoProps) => {
  const { resolvedTheme } = useNextTheme();
  const isDark = resolvedTheme === "dark";

  let src: string;
  if (variant === "full" && useOrange) {
    src = logoMap.full.orange;
  } else if (variant === "full") {
    src = isDark ? logoMap.full.dark : logoMap.full.light;
  } else {
    src = isDark ? logoMap.icon.dark : logoMap.icon.light;
  }

  const defaultSize = variant === "icon" ? "h-16 w-16" : "h-12 md:h-14";

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
