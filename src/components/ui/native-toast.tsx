import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { Xmark, CheckCircle, WarningCircle, InfoCircle, WarningTriangle } from "iconoir-react"
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
        "pointer-events-none fixed z-[100] flex max-h-screen w-full flex-col gap-2 p-4 md:max-w-[420px]",
        "top-4 left-4 right-4 md:top-4 md:left-auto md:right-4 md:translate-x-0",
        "max-w-[calc(100%-2rem)] md:max-w-[420px]",
        className
      )}
      {...props}
    />
  )
})
NativeToastViewport.displayName = ToastPrimitives.Viewport.displayName

const nativeToastVariants = cva(
  "group pointer-events-auto relative flex min-h-[56px] w-full items-start justify-between gap-3 overflow-hidden rounded-md border p-4 pr-10 shadow-lg transition-all data-[swipe=cancel]:translate-y-0 data-[swipe=end]:translate-y-[var(--radix-toast-swipe-end-y)] data-[swipe=move]:translate-y-[var(--radix-toast-swipe-move-y)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80",
  {
    variants: {
      variant: {
        default: "border-border/70 bg-card text-card-foreground",
        destructive: "destructive group border-destructive/50 bg-destructive/10 text-foreground",
        success: "border-green-500/35 bg-green-500/10 text-foreground",
        warning: "border-yellow-500/35 bg-yellow-500/10 text-foreground",
        info: "border-blue-500/35 bg-blue-500/10 text-foreground",
      },
      platform: {
        ios: "data-[state=closed]:slide-out-to-top-full data-[state=open]:slide-in-from-top-full min-h-[60px] backdrop-blur-xl",
        android: "data-[state=closed]:slide-out-to-top-full data-[state=open]:slide-in-from-top-full rounded-lg shadow-xl",
        web: "data-[state=closed]:slide-out-to-top-full data-[state=open]:slide-in-from-top-full",
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
      "font-sans inline-flex h-8 shrink-0 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
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
      "absolute right-3 top-3 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100",
      platform === 'ios' && "right-2.5 top-2.5",
      platform === 'android' && "right-3 top-3",
      className
    )}
    toast-close=""
    {...props}
  >
    <Xmark className="h-4 w-4" />
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
      "font-sans text-sm font-semibold leading-snug",
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
      "font-sans text-sm leading-snug text-muted-foreground break-words",
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
      return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
    case 'destructive':
      return <WarningCircle className="h-5 w-5 text-destructive" />
    case 'warning':
      return <WarningTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
    case 'info':
      return <InfoCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
    default:
      return <InfoCircle className="h-5 w-5 text-muted-foreground" />
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
