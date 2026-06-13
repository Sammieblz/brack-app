import { NavArrowLeft } from "iconoir-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type BackButtonConfig, useAppBack } from "@/hooks/useAppBack";

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
  const resolvedSize = size ?? (showLabel ? "sm" : "icon");

  return (
    <Button
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
