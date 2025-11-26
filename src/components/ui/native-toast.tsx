import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePlatform } from "@/hooks/usePlatform"

const NativeToastProvider = ToastPrimitives.Provider

const NativeToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport> & {
    platform?: 'ios' | 'android' | 'web'
  }
>(({ className, platform = 'web', ...props }, ref) => {
  return (
    <ToastPrimitives.Viewport
      ref={ref}
      className={cn(
        "fixed z-[100] flex max-h-screen w-full flex-col p-4 md:max-w-[420px] top-0 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0",
        className
      )}
      {...props}
    />
  )
})
NativeToastViewport.displayName = ToastPrimitives.Viewport.displayName

const nativeToastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md transition-all data-[swipe=cancel]:translate-y-0 data-[swipe=end]:translate-y-[var(--radix-toast-swipe-end-y)] data-[swipe=move]:translate-y-[var(--radix-toast-swipe-move-y)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive: "destructive group border-destructive bg-destructive text-destructive-foreground",
        success: "border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400",
        warning: "border-yellow-500/50 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
      },
      platform: {
        ios: "data-[state=closed]:slide-out-to-top-full data-[state=open]:slide-in-from-top-full backdrop-blur-xl bg-background/80 border-border/50 shadow-lg",
        android: "data-[state=closed]:slide-out-to-top-full data-[state=open]:slide-in-from-top-full shadow-2xl border-0 rounded-lg",
        web: "data-[state=closed]:slide-out-to-top-full data-[state=open]:slide-in-from-top-full shadow-lg border",
      },
    },
    defaultVariants: {
      variant: "default",
      platform: "web",
    },
  }
)

const NativeToast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof nativeToastVariants> & {
      platform?: 'ios' | 'android' | 'web'
    }
>(({ className, variant, platform = 'web', ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(
        nativeToastVariants({ variant, platform }),
        platform === 'ios' && "p-3 min-h-[60px]",
        platform === 'android' && "p-4 min-h-[56px]",
        className
      )}
      {...props}
    />
  )
})
NativeToast.displayName = ToastPrimitives.Root.displayName

const NativeToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action> & {
    platform?: 'ios' | 'android' | 'web'
  }
>(({ className, platform = 'web', ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      platform === 'ios' && "text-primary font-semibold",
      platform === 'android' && "text-primary uppercase tracking-wider text-xs font-bold",
      "hover:bg-secondary",
      className
    )}
    {...props}
  />
))
NativeToastAction.displayName = ToastPrimitives.Action.displayName

const NativeToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close> & {
    platform?: 'ios' | 'android' | 'web'
  }
>(({ className, platform = 'web', ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute top-2 right-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100",
      platform === 'ios' && "top-1 right-1",
      platform === 'android' && "top-2 right-2",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
NativeToastClose.displayName = ToastPrimitives.Close.displayName

const NativeToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title> & {
    platform?: 'ios' | 'android' | 'web'
  }
>(({ className, platform = 'web', ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn(
      "text-sm font-semibold",
      platform === 'ios' && "text-base",
      platform === 'android' && "text-sm font-medium",
      className
    )}
    {...props}
  />
))
NativeToastTitle.displayName = ToastPrimitives.Title.displayName

const NativeToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description> & {
    platform?: 'ios' | 'android' | 'web'
  }
>(({ className, platform = 'web', ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn(
      "text-sm opacity-90",
      platform === 'ios' && "text-sm",
      platform === 'android' && "text-sm",
      className
    )}
    {...props}
  />
))
NativeToastDescription.displayName = ToastPrimitives.Description.displayName

type NativeToastProps = React.ComponentPropsWithoutRef<typeof NativeToast>
type NativeToastActionElement = React.ReactElement<typeof NativeToastAction>

const getToastIcon = (variant?: string) => {
  switch (variant) {
    case 'success':
      return <CheckCircle2 className="h-5 w-5" />
    case 'destructive':
      return <AlertCircle className="h-5 w-5" />
    case 'warning':
      return <AlertTriangle className="h-5 w-5" />
    default:
      return <Info className="h-5 w-5" />
  }
}

export {
  type NativeToastProps,
  type NativeToastActionElement,
  NativeToastProvider,
  NativeToastViewport,
  NativeToast,
  NativeToastTitle,
  NativeToastDescription,
  NativeToastClose,
  NativeToastAction,
  getToastIcon,
}
