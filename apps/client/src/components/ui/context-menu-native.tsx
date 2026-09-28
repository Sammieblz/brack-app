import * as React from "react";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { isLongPressExcluded, useLongPress } from "@/hooks/useLongPress";
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
  hapticsEnabled?: boolean;
}

export function ContextMenuNative({
  children,
  actions,
  title,
  description,
  hapticsEnabled = true,
}: ContextMenuNativeProps) {
  const [open, setOpen] = React.useState(false);
  const { triggerHaptic } = useHapticFeedback({ enabled: hapticsEnabled });

  const longPressHandlers = useLongPress({
    onLongPress: () => {
      setOpen(true);
    },
    delay: 500,
    hapticsEnabled,
  });

  const openFromKeyboard = (event: React.KeyboardEvent) => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div className="min-w-0">
      <div
        {...longPressHandlers}
        className="touch-manipulation"
        onContextMenu={(event) => {
          longPressHandlers.onContextMenu();
          if (isLongPressExcluded(event.target) || window.getSelection()?.toString()) return;
          event.preventDefault();
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (!isLongPressExcluded(event.target)) openFromKeyboard(event);
        }}
      >
        {children}
      </div>
      <ActionSheet
        open={open}
        onOpenChange={setOpen}
        title={title || 'Actions'}
        description={description}
        actions={actions}
        openHaptic={false}
        hapticsEnabled={hapticsEnabled}
        trigger={
          <button
            type="button"
            aria-label={title ? `More actions for ${title}` : 'More actions'}
            onKeyDown={openFromKeyboard}
            onClick={(event) => { if (event.detail > 0) void triggerHaptic('selection'); }}
            className="ml-auto flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            More actions
          </button>
        }
      />
    </div>
  );
}
