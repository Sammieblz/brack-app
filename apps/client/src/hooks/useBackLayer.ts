import { useCallback, useRef, type ForwardedRef, type MutableRefObject } from "react";
import { registerBackLayer } from "@/lib/backLayers";

/** Compose the content's real ref without adding a focus, state or router owner. */
export function useBackLayer<T extends HTMLElement>(forwardedRef?: ForwardedRef<T>) {
  const unregister = useRef<(() => void) | undefined>();
  return useCallback((element: T | null) => {
    unregister.current?.();
    unregister.current = element ? registerBackLayer(element) : undefined;
    if (typeof forwardedRef === "function") forwardedRef(element);
    else if (forwardedRef) (forwardedRef as MutableRefObject<T | null>).current = element;
  }, [forwardedRef]);
}
