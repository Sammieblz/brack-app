import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AdaptiveDialogBody,
  AdaptiveDialogContent,
  AdaptiveDialogDescription,
  AdaptiveDialogFooter,
  AdaptiveDialogHeader,
  AdaptiveDialogTitle,
} from "@/components/ui/adaptive-dialog";
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
  /** The initiating control may already own the opening feedback. */
  openHaptic?: boolean;
  hapticsEnabled?: boolean;
  /** For controlled sheets whose visible invoker is outside DialogTrigger. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export function ActionSheet({
  trigger,
  title,
  description,
  actions,
  cancelLabel = "Cancel",
  open,
  onOpenChange,
  openHaptic = true,
  hapticsEnabled = true,
  returnFocusRef,
}: ActionSheetProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open ?? internalOpen;
  const { triggerHaptic } = useHapticFeedback({ enabled: hapticsEnabled });
  const setOpen = (nextOpen: boolean) => {
    if (open === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  const regularActions = actions.filter((action) => action.variant !== 'destructive');
  const destructiveActions = actions.filter((action) => action.variant === 'destructive');

  const handleActionClick = (action: ActionSheetProps['actions'][0]) => {
    triggerHaptic('selection');
    action.onClick();
    setOpen(false);
  };

  const renderAction = (action: ActionSheetProps['actions'][0], index: number) => (
    <button
      key={index}
      type="button"
      onClick={() => handleActionClick(action)}
      className={cn(
        "font-sans flex min-h-11 w-full items-center gap-3 rounded-lg px-4 py-3 text-left font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        action.variant === 'destructive'
          ? "text-foreground hover:bg-destructive/10"
          : "text-foreground hover:bg-muted",
      )}
    >
      {action.icon && <span className="shrink-0 text-lg" aria-hidden="true">{action.icon}</span>}
      <span className="min-w-0 break-words">{action.label}</span>
    </button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <AdaptiveDialogContent
        size="compact"
        disableHaptic={!hapticsEnabled}
        openHaptic={openHaptic}
        {...(!description ? { "aria-describedby": undefined } : {})}
        onCloseAutoFocus={(event) => {
          if (returnFocusRef?.current?.isConnected) {
            event.preventDefault();
            // An action may present its own confirmation before this sheet
            // unmounts. Its focus scope takes precedence over our old invoker.
            const activeDialog = document.activeElement?.closest('[role="dialog"], [role="alertdialog"]');
            if (activeDialog && activeDialog !== event.target && activeDialog.getAttribute("data-state") !== "closed") return;
            returnFocusRef.current.focus();
          }
        }}
      >
        <AdaptiveDialogHeader>
          <AdaptiveDialogTitle>{title || "Actions"}</AdaptiveDialogTitle>
          {description && <AdaptiveDialogDescription>{description}</AdaptiveDialogDescription>}
        </AdaptiveDialogHeader>
        <AdaptiveDialogBody className="space-y-2">
          {regularActions.length > 0 && <div className="space-y-2">{regularActions.map(renderAction)}</div>}
          {destructiveActions.length > 0 && (
            <div role="group" aria-label="Destructive actions" className={cn("space-y-2", regularActions.length > 0 && "border-t border-border pt-2")}>
              {destructiveActions.map(renderAction)}
            </div>
          )}
        </AdaptiveDialogBody>
        <AdaptiveDialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={cn(
              "font-sans min-h-11 w-full rounded-lg px-4 py-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "bg-muted text-foreground hover:bg-muted/80",
              "transition-colors"
            )}
          >
            {cancelLabel}
          </button>
        </AdaptiveDialogFooter>
      </AdaptiveDialogContent>
    </Dialog>
  );
}
