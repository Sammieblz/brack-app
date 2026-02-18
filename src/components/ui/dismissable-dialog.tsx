import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePullToDismiss } from "@/hooks/usePullToDismiss"
import { useIsMobile } from "@/hooks/use-mobile"

const DismissableDialog = DialogPrimitive.Root
const DismissableDialogTrigger = DialogPrimitive.Trigger
const DismissableDialogPortal = DialogPrimitive.Portal
const DismissableDialogClose = DialogPrimitive.Close

const DismissableDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DismissableDialogOverlay.displayName = DialogPrimitive.Overlay.displayName

interface DismissableDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  enablePullToDismiss?: boolean;
}

const DismissableDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DismissableDialogContentProps
>(({ className, children, enablePullToDismiss = true, ...props }, ref) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(true);

  const { containerRef, pullState } = usePullToDismiss({
    onDismiss: () => setOpen(false),
    threshold: 80,
    enabled: enablePullToDismiss && isMobile,
    rubberBandEffect: true,
  });

  // Calculate transform based on pull distance
  const transform = pullState.isPulling 
    ? `translateY(${pullState.pullDistance}px)`
    : 'translateY(0)';

  const opacity = pullState.isPulling
    ? Math.max(0.5, 1 - pullState.pullDistance / 300)
    : 1;

  return (
    <DismissableDialogPortal>
      <DismissableDialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-lg",
          isMobile && "max-h-[90vh] bottom-0 top-auto translate-y-0 rounded-t-[20px] rounded-b-none data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className
        )}
        onOpenAutoFocus={(e) => {
          // Prevent auto-focus on mobile
          if (isMobile) {
            e.preventDefault();
          }
        }}
        {...props}
      >
        <div
          ref={containerRef}
          className="h-full"
          style={{
            transform,
            opacity,
            transition: pullState.isPulling ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 0.3s',
          }}
        >
          {/* Pull indicator handle - only on mobile */}
          {isMobile && enablePullToDismiss && (
            <div className="flex justify-center -mt-3 mb-3 touch-none">
              <div 
                className={cn(
                  "w-10 h-1 rounded-full bg-muted-foreground/30 transition-all",
                  pullState.isPulling && "w-12 bg-muted-foreground/50",
                  pullState.shouldDismiss && "w-14 bg-primary/50"
                )}
              />
            </div>
          )}

          {/* Content with scroll container */}
          <div 
            data-pull-dismiss-content 
            className="overflow-auto overscroll-contain max-h-[80vh]"
          >
            {children}
          </div>
        </div>

        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DismissableDialogPortal>
  )
})
DismissableDialogContent.displayName = DialogPrimitive.Content.displayName

const DismissableDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DismissableDialogHeader.displayName = "DismissableDialogHeader"

const DismissableDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DismissableDialogFooter.displayName = "DismissableDialogFooter"

const DismissableDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "font-display text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DismissableDialogTitle.displayName = DialogPrimitive.Title.displayName

const DismissableDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("font-sans text-sm text-muted-foreground", className)}
    {...props}
  />
))
DismissableDialogDescription.displayName =
  DialogPrimitive.Description.displayName

export {
  DismissableDialog,
  DismissableDialogPortal,
  DismissableDialogOverlay,
  DismissableDialogClose,
  DismissableDialogTrigger,
  DismissableDialogContent,
  DismissableDialogHeader,
  DismissableDialogFooter,
  DismissableDialogTitle,
  DismissableDialogDescription,
}
