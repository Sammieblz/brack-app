import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

const getInitialPreference = () =>
  typeof window !== "undefined" && window.matchMedia(QUERY).matches;

/** Reactive, shared reduced-motion preference for animations and celebrations. */
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getInitialPreference);

  useEffect(() => {
    const mediaQuery = window.matchMedia(QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
};
