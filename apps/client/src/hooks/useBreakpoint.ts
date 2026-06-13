import * as React from "react";

export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

const getWidth = () => (typeof window === "undefined" ? 0 : window.innerWidth);

export const useBreakpoint = () => {
  const [width, setWidth] = React.useState(getWidth);

  React.useEffect(() => {
    const handleResize = () => setWidth(getWidth());

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return {
    width,
    isPhone: width < BREAKPOINTS.tablet,
    isTablet: width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop,
    isDesktop: width >= BREAKPOINTS.desktop && width < BREAKPOINTS.wide,
    isWideDesktop: width >= BREAKPOINTS.wide,
  };
};
