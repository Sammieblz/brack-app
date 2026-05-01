import { useEffect } from "react";

export const useAppViewportHeight = () => {
  useEffect(() => {
    const updateViewportHeight = () => {
      document.documentElement.style.setProperty(
        "--app-viewport-height",
        `${window.innerHeight}px`
      );
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    window.addEventListener("orientationchange", updateViewportHeight);
    window.visualViewport?.addEventListener("resize", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("orientationchange", updateViewportHeight);
      window.visualViewport?.removeEventListener("resize", updateViewportHeight);
    };
  }, []);
};
