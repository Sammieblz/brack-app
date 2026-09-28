import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Xmark } from "iconoir-react";
import { useBackLayer } from "@/hooks/useBackLayer";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useUIEnvironment } from "@/hooks/useUIEnvironment";
import { useOverlayViewport } from "@/hooks/useOverlayViewport";
import { prefersSheetPresentation } from "@/lib/overlayViewport";
import { cn } from "@/lib/utils";
import "./adaptive-dialog.css";

export { DialogTitle as AdaptiveDialogTitle, DialogDescription as AdaptiveDialogDescription } from "./dialog";

type ContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  size?: "compact" | "regular" | "wide";
  disableHaptic?: boolean;
  openHaptic?: boolean;
  showClose?: boolean;
};

/** One focus, Back and scroll-lock owner throughout an open responsive task. */
export const AdaptiveDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>, ContentProps
>(({ children, className, style, size = "regular", disableHaptic = false, openHaptic = true, showClose = true,
  onOpenAutoFocus, onPointerDownOutside, ...props }, ref) => {
  const backLayerRef = useBackLayer(ref);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const setContentRef = React.useCallback((element: HTMLDivElement | null) => {
    contentRef.current = element;
    backLayerRef(element);
  }, [backLayerRef]);
  const environment = useUIEnvironment();
  const viewport = useOverlayViewport();
  const { triggerHaptic } = useHapticFeedback({ enabled: !disableHaptic });
  React.useLayoutEffect(() => {
    const content = contentRef.current;
    const active = document.activeElement;
    // Geometry changes must not hide the field being edited. Move only the
    // existing scroll position, never focus/selection or browser pinch framing.
    if (environment.visualScale !== 1 || !content || !(active instanceof HTMLElement) || !content.contains(active)) return;
    const bounds = content.getBoundingClientRect();
    const field = active.getBoundingClientRect();
    if (field.top < bounds.top || field.bottom > bounds.bottom) {
      active.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    }
  }, [viewport, environment.visualScale, environment.windowClass, environment.anyCoarsePointer]);
  const geometry = {
    "--overlay-left": `${viewport.left}px`, "--overlay-top": `${viewport.top}px`,
    "--overlay-width": viewport.width > 0 ? `${viewport.width}px` : "100vw",
    "--overlay-height": viewport.height > 0 ? `${viewport.height}px` : "100dvh",
    ...style,
  } as React.CSSProperties;
  return <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="adaptive-dialog-backdrop" />
    <DialogPrimitive.Content {...props} ref={setContentRef} style={geometry}
      className={cn("adaptive-dialog", className)} data-size={size}
      data-presentation={prefersSheetPresentation(environment) ? "sheet" : "center"}
      onPointerDownOutside={(event) => {
        onPointerDownOutside?.(event);
        // A guard can synchronously open a confirmation. The outside pointer's
        // native default must not blur its newly focused safe action afterward.
        event.detail.originalEvent.preventDefault();
      }}
      onOpenAutoFocus={(event) => {
        onOpenAutoFocus?.(event);
        if (!disableHaptic && openHaptic) void triggerHaptic("light");
      }}>
      {children}
      {showClose && <DialogPrimitive.Close type="button" className="adaptive-dialog-close"
        onClick={(event) => { event.currentTarget.focus(); void triggerHaptic("selection"); }}>
        <Xmark className="size-5" aria-hidden="true" /><span className="sr-only">Close</span>
      </DialogPrimitive.Close>}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>;
});
AdaptiveDialogContent.displayName = "AdaptiveDialogContent";

export const AdaptiveDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
  <div className={cn("adaptive-dialog-header", className)} {...props} />;
export const AdaptiveDialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
  <div className={cn("adaptive-dialog-body", className)} {...props} />;
export const AdaptiveDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
  <div className={cn("adaptive-dialog-footer", className)} {...props} />;
