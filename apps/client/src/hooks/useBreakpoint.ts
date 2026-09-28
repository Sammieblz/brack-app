import { useUIEnvironmentValue } from "./useUIEnvironment";

export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

export const useBreakpoint = () => {
  const width = useUIEnvironmentValue((environment) => environment.layoutWidth);

  return {
    width,
    isPhone: width < BREAKPOINTS.tablet,
    isTablet: width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop,
    isDesktop: width >= BREAKPOINTS.desktop && width < BREAKPOINTS.wide,
    isWideDesktop: width >= BREAKPOINTS.wide,
  };
};
