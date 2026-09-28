import { useEffect } from "react";
import { useUIEnvironmentValue } from "./useUIEnvironment";

export const useAppViewportHeight = () => {
  const layoutHeight = useUIEnvironmentValue((environment) => environment.layoutHeight);
  useEffect(() => {
    // Preserve the page scroller's layout-height contract. Keyboard/pinch
    // visual geometry is available separately through useUIEnvironment.
    document.documentElement.style.setProperty("--app-viewport-height", `${layoutHeight}px`);
  }, [layoutHeight]);
};
