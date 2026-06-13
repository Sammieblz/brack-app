import * as React from "react";
import { cn } from "@/lib/utils";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useLongPress } from "@/hooks/useLongPress";
import { ActionSheet } from "./action-sheet";

interface ContextMenuNativeProps {
  children: React.ReactNode;
  actions: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive';
    icon?: React.ReactNode;
  }>;
  title?: string;
  description?: string;
}

export function ContextMenuNative({
  children,
  actions,
  title,
  description,
}: ContextMenuNativeProps) {
  const [open, setOpen] = React.useState(false);
  const { triggerHaptic } = useHapticFeedback();

  const longPressHandlers = useLongPress({
    onLongPress: () => {
      setOpen(true);
      triggerHaptic('medium');
    },
    delay: 500,
  });

  return (
    <>
      <div {...longPressHandlers} className="touch-manipulation">
        {children}
      </div>
      <ActionSheet
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        actions={actions}
      />
    </>
  );
}
