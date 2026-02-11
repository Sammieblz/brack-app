import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 min-h-[44px] touch-manipulation",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm focus-visible:ring-primary/50",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm focus-visible:ring-destructive/50",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-ring hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-ring/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-ring/50",
        ghost: "hover:bg-accent hover:text-accent-foreground active:bg-accent/80 focus-visible:ring-ring/50",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80 focus-visible:ring-ring/50",
      },
      size: {
        default: "h-11 px-4 py-2 min-h-[44px]", // Minimum 44px tap target
        sm: "h-10 rounded-md px-3 min-h-[44px]", // Still 44px minimum
        lg: "h-12 rounded-md px-8 min-h-[48px]", // Larger for important actions
        icon: "h-11 w-11 min-h-[44px] min-w-[44px]", // Square, minimum 44px
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  disableHaptic?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, disableHaptic = false, onClick, ...props }, ref) => {
    const { triggerHaptic } = useHapticFeedback()
    const Comp = asChild ? Slot : "button"
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disableHaptic && !props.disabled) {
        // Different haptic patterns based on variant
        if (variant === 'destructive') {
          triggerHaptic('medium')
        } else if (variant === 'default') {
          triggerHaptic('light')
        } else {
          triggerHaptic('selection')
        }
      }
      onClick?.(e)
    }
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
