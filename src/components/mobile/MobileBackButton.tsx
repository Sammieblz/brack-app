import { useNavigate } from "react-router-dom";
import { ChevronLeft, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlatform } from "@/hooks/usePlatform";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

interface MobileBackButtonProps {
  title?: string;
  onClick?: () => void;
  className?: string;
}

export const MobileBackButton = ({ title, onClick, className }: MobileBackButtonProps) => {
  const navigate = useNavigate();
  const { platform } = usePlatform();
  const { triggerHaptic } = useHapticFeedback();

  const handleBack = () => {
    triggerHaptic("light");
    if (onClick) {
      onClick();
    } else {
      navigate(-1);
    }
  };

  const isIOS = platform === 'ios';

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className={cn(
        "h-10 px-2 -ml-2 touch-manipulation",
        isIOS && "rounded-full",
        !isIOS && "rounded-lg",
        className
      )}
    >
      {isIOS ? (
        <ChevronLeft className="h-6 w-6" />
      ) : (
        <ArrowLeft className="h-5 w-5" />
      )}
      {title && (
        <span className={cn(
          "ml-1 font-medium",
          isIOS && "text-base",
          !isIOS && "text-sm"
        )}>
          {title}
        </span>
      )}
    </Button>
  );
};
