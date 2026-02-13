import { useToast } from "@/hooks/use-toast"
import { usePlatform } from "@/hooks/usePlatform"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import {
  NativeToast,
  NativeToastClose,
  NativeToastDescription,
  NativeToastProvider,
  NativeToastTitle,
  NativeToastViewport,
  getToastIcon,
} from "@/components/ui/native-toast"
import { useEffect } from "react"

export function Toaster() {
  const { toasts } = useToast()
  const { platform } = usePlatform()
  const { triggerHaptic } = useHapticFeedback()

  // Trigger haptic feedback when toast appears
  useEffect(() => {
    const visibleToasts = toasts.filter(t => t.open)
    if (visibleToasts.length > 0) {
      const latestToast = visibleToasts[visibleToasts.length - 1]
      const variant = latestToast.variant as string | undefined
      if (variant === 'destructive') {
        triggerHaptic('error')
      } else if (variant === 'success') {
        triggerHaptic('success')
      } else {
        triggerHaptic('light')
      }
    }
  }, [toasts, triggerHaptic])

  return (
    <NativeToastProvider duration={2500} swipeDirection="right">
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const variant = props.variant as string | undefined
        
        return (
          <NativeToast key={id} platform={platform} {...props}>
            <div className="flex items-start gap-3 flex-1">
              {variant && (
                <div className="mt-0.5 shrink-0">
                  {getToastIcon(variant)}
                </div>
              )}
              <div className="grid gap-1 flex-1">
                {title && <NativeToastTitle platform={platform}>{title}</NativeToastTitle>}
                {description && (
                  <NativeToastDescription platform={platform}>
                    {description}
                  </NativeToastDescription>
                )}
              </div>
            </div>
            {action}
            <NativeToastClose platform={platform} />
          </NativeToast>
        )
      })}
      <NativeToastViewport platform={platform} />
    </NativeToastProvider>
  )
}
