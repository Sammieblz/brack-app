import { forwardRef, useState, type ComponentPropsWithoutRef, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  AdaptiveDialogBody,
  AdaptiveDialogContent,
  AdaptiveDialogDescription,
  AdaptiveDialogHeader,
  AdaptiveDialogTitle,
} from "@/components/ui/adaptive-dialog";
import { GoalManager } from "@/components/GoalManager";
import { useAuth } from "@/hooks/useAuth";
import { APP_ICONS } from "@/config/iconography";

export const GoalsSheetTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof Button>>(
  (props, ref) => <Button ref={ref} variant="outline" size="sm" className="gap-2" {...props}>
    <APP_ICONS.dashboard.goal className="h-4 w-4" aria-hidden="true" />
    Goals
  </Button>,
);
GoalsSheetTrigger.displayName = "GoalsSheetTrigger";

interface GoalsSheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Pass null when the invoker lives in a responsive header outside this root. */
  trigger?: ReactNode;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export const GoalsSheet = ({ open, onOpenChange, trigger, returnFocusRef }: GoalsSheetProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const { user } = useAuth();
  const isOpen = open ?? internalOpen;
  const setOpen = (nextOpen: boolean) => {
    if (open === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger !== null && <DialogTrigger asChild>{trigger ?? <GoalsSheetTrigger />}</DialogTrigger>}
      <AdaptiveDialogContent size="wide" onCloseAutoFocus={(event) => {
        if (returnFocusRef?.current?.isConnected) {
          event.preventDefault();
          returnFocusRef.current.focus();
        }
      }}>
        <AdaptiveDialogHeader>
          <AdaptiveDialogTitle>Reading Goals</AdaptiveDialogTitle>
          <AdaptiveDialogDescription>Set and track your reading goals</AdaptiveDialogDescription>
        </AdaptiveDialogHeader>
        <AdaptiveDialogBody>
          <GoalManager userId={user.id} />
        </AdaptiveDialogBody>
      </AdaptiveDialogContent>
    </Dialog>
  );
};
