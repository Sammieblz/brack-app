import { useBreakpoint } from "@/hooks/useBreakpoint"

export function useIsMobile() {
  return useBreakpoint().isPhone
}
