import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePullToDismiss } from "@/hooks/usePullToDismiss"
import { usePlatform } from "@/hooks/usePlatform"

const DismissableSheet = SheetPrimitive.Root
const DismissableSheetTrigger = SheetPrimitive.Trigger
const DismissableSheetClose = SheetPrimitive.Close
const DismissableSheetPortal = SheetPrimitive.Portal

const DismissableSheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
DismissableSheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const dismissableSheetVariants = cva(
  "fixed z-50 gap-4 bg-background shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom rounded-t-[20px]",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "bottom",
    },
  }
)

interface DismissableSheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof dismissableSheetVariants> {
  enablePullToDismiss?: boolean;
}

const DismissableSheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  DismissableSheetContentProps
>(({ side = "bottom", className, children, enablePullToDismiss = true, ...props }, ref) => {
  const { platform } = usePlatform();
  const [open, setOpen] = React.useState(true);

  const { containerRef, pullState } = usePullToDismiss({
    onDismiss: () => setOpen(false),
    threshold: 100,
    enabled: enablePullToDismiss && side === "bottom",
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
    <DismissableSheetPortal>
      <DismissableSheetOverlay />
      <SheetPrimitive.Content
        ref={ref}
        className={cn(dismissableSheetVariants({ side }), className)}
        onOpenAutoFocus={(e) => {
          // Prevent auto-focus which can cause keyboard to appear on mobile
          e.preventDefault();
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
          {/* Pull indicator handle - iOS style */}
          {side === "bottom" && enablePullToDismiss && (
            <div className="flex justify-center pt-3 pb-2 -mb-2 touch-none">
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
            className="h-full overflow-auto overscroll-contain"
          >
            {children}
          </div>
        </div>

        {/* Close button - optional */}
        <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </DismissableSheetPortal>
  );
})
DismissableSheetContent.displayName = SheetPrimitive.Content.displayName

const DismissableSheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left px-6 pt-4",
      className
    )}
    {...props}
  />
)
DismissableSheetHeader.displayName = "DismissableSheetHeader"

const DismissableSheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 px-6 pb-6",
      className
    )}
    {...props}
  />
)
DismissableSheetFooter.displayName = "DismissableSheetFooter"

const DismissableSheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("font-display text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
DismissableSheetTitle.displayName = SheetPrimitive.Title.displayName

const DismissableSheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("font-sans text-sm text-muted-foreground", className)}
    {...props}
  />
))
DismissableSheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  DismissableSheet,
  DismissableSheetPortal,
  DismissableSheetOverlay,
  DismissableSheetTrigger,
  DismissableSheetClose,
  DismissableSheetContent,
  DismissableSheetHeader,
  DismissableSheetFooter,
  DismissableSheetTitle,
  DismissableSheetDescription,
}
