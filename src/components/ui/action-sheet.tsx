import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePlatform } from "@/hooks/usePlatform";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

interface ActionSheetProps {
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
  actions: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive';
    icon?: React.ReactNode;
  }>;
  cancelLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ActionSheet({
  trigger,
  title,
  description,
  actions,
  cancelLabel = "Cancel",
  open,
  onOpenChange,
}: ActionSheetProps) {
  const { isIOS } = usePlatform();
  const { triggerHaptic } = useHapticFeedback();

  const handleActionClick = (action: ActionSheetProps['actions'][0]) => {
    triggerHaptic('selection');
    action.onClick();
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent 
        className={cn(
          "sm:max-w-md",
          isIOS 
            ? "rounded-t-[20px] sm:rounded-[20px] bottom-0 top-auto translate-y-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom" 
            : "rounded-t-[16px] sm:rounded-[16px]"
        )}
      >
        {(title || description) && (
          <DialogHeader className="text-center sm:text-center">
            {title && <DialogTitle className="font-display text-lg">{title}</DialogTitle>}
            {description && (
              <DialogDescription className="font-sans text-sm">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        )}
        
        <div className="flex flex-col gap-2 py-4">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleActionClick(action)}
              className={cn(
                "font-sans flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors",
                "active:scale-[0.98] transition-transform duration-100",
                action.variant === 'destructive'
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-foreground hover:bg-muted"
              )}
            >
              {action.icon && <span className="text-lg">{action.icon}</span>}
              {action.label}
            </button>
          ))}
          
          <button
            onClick={() => onOpenChange?.(false)}
            className={cn(
              "font-sans mt-2 px-4 py-3 rounded-lg font-semibold",
              "bg-muted text-foreground hover:bg-muted/80",
              "active:scale-[0.98] transition-transform duration-100"
            )}
          >
            {cancelLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
