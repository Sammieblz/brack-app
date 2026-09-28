import { NavArrowLeft } from "iconoir-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type BackButtonConfig, useAppBack } from "@/hooks/useAppBack";
import { useContext, useLayoutEffect, useRef } from "react";
import { AppNavigationContext } from "@/contexts/appNavigation";

interface AppBackButtonProps
  extends BackButtonConfig,
    Omit<ButtonProps, "children" | "onClick"> {
  showLabel?: boolean;
  iconClassName?: string;
}

export const AppBackButton = ({
  label = "Back",
  ariaLabel,
  fallbackPath,
  to,
  onBack,
  showLabel = false,
  iconClassName,
  className,
  variant = "ghost",
  size,
  ...props
}: AppBackButtonProps) => {
  const { goBack } = useAppBack({ fallbackPath, to, onBack });
  const button = useRef<HTMLButtonElement>(null);
  const latestAction = useRef({ fallbackPath, to, onBack });
  latestAction.current = { fallbackPath, to, onBack };
  const navigation = useContext(AppNavigationContext);
  const register = navigation?.registerControl;
  const routeKey = navigation?.routeKey;
  useLayoutEffect(() => {
    if (button.current && register && routeKey) return register(button.current, () => latestAction.current, routeKey);
  }, [register, routeKey]);
  const resolvedSize = size ?? (showLabel ? "sm" : "icon");

  return (
    <Button
      ref={button}
      type="button"
      variant={variant}
      size={resolvedSize}
      onClick={goBack}
      aria-label={ariaLabel ?? label}
      className={cn(
        "shrink-0 rounded-full text-muted-foreground hover:text-foreground",
        showLabel && "px-3",
        className
      )}
      {...props}
    >
      <NavArrowLeft className={cn("h-5 w-5", iconClassName)} />
      {showLabel && <span className="font-sans font-medium">{label}</span>}
    </Button>
  );
};
