import { Button } from "@/components/ui/button";
import { AppIcon } from "@/components/ui/app-icon";
import { APP_ICONS } from "@/config/iconography";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

interface ThemeToggleProps {
  className?: string;
  /** "floating" positions absolute top-right, "inline" renders inline */
  variant?: "floating" | "inline";
}

export const ThemeToggle = ({ className, variant = "floating" }: ThemeToggleProps) => {
  const { resolvedTheme, setThemeMode } = useTheme();
  const { triggerHaptic } = useHapticFeedback();
  const isDark = resolvedTheme === "dark";

  const toggle = () => {
    triggerHaptic("selection");
    void setThemeMode(isDark ? "light" : "dark");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      className={cn(
        "h-10 w-10 rounded-full bg-background/60 backdrop-blur-md border border-border/40 shadow-sm hover:shadow-md transition-all duration-300",
        variant === "floating" && "fixed top-4 right-4 z-50",
        className
      )}
    >
      {isDark ? (
        <AppIcon icon={APP_ICONS.common.themeLight} variant="action" size="md" className="text-yellow-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <AppIcon icon={APP_ICONS.common.themeDark} variant="action" size="md" className="text-slate-700 transition-transform duration-300 rotate-0 hover:-rotate-12 dark:text-slate-200" />
      )}
    </Button>
  );
};
