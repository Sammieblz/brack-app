import { AppBackButton } from "@/components/AppBackButton";
import { cn } from "@/lib/utils";
import { usePlatform } from "@/hooks/usePlatform";
import type { BackButtonConfig } from "@/hooks/useAppBack";

interface MobileBackButtonProps extends BackButtonConfig {
  title?: string;
  onClick?: () => void;
  className?: string;
}

export const MobileBackButton = ({
  title,
  onClick,
  className,
  label,
  onBack,
  ...backConfig
}: MobileBackButtonProps) => {
  const { platform } = usePlatform();
  const isIOS = platform === 'ios';
  const resolvedLabel = title ?? label ?? "Back";

  return (
    <AppBackButton
      {...backConfig}
      onBack={onClick ?? onBack}
      label={resolvedLabel}
      showLabel
      className={cn(
        "h-10 px-2 -ml-2 touch-manipulation",
        isIOS && "rounded-full",
        !isIOS && "rounded-lg",
        className
      )}
      iconClassName={isIOS ? "h-6 w-6" : "h-5 w-5"}
    />
  );
};
