import { useTheme as useNextTheme } from "next-themes";
import { SunLight, HalfMoon } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  /** "floating" positions absolute top-right, "inline" renders inline */
  variant?: "floating" | "inline";
}

export const ThemeToggle = ({ className, variant = "floating" }: ThemeToggleProps) => {
  const { resolvedTheme, setTheme } = useNextTheme();
  const { triggerHaptic } = useHapticFeedback();
  const isDark = resolvedTheme === "dark";

  const toggle = () => {
    triggerHaptic("selection");
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "h-10 w-10 rounded-full bg-background/60 backdrop-blur-md border border-border/40 shadow-sm hover:shadow-md transition-all duration-300",
        variant === "floating" && "fixed top-4 right-4 z-50",
        className
      )}
    >
      {isDark ? (
        <SunLight className="h-5 w-5 text-yellow-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <HalfMoon className="h-5 w-5 text-slate-700 transition-transform duration-300 rotate-0 hover:-rotate-12" />
      )}
    </Button>
  );
};
