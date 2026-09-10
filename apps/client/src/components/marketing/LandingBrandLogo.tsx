import { cn } from "@/lib/utils";

interface LandingBrandLogoProps {
  className?: string;
  eager?: boolean;
}

/** The supplied transparent orange campaign wordmark for public surfaces. */
export const LandingBrandLogo = ({
  className,
  eager = false,
}: LandingBrandLogoProps) => (
  <span
    className={cn(
      "relative inline-block aspect-[854/229] shrink-0",
      className,
    )}
  >
    <img
      src="/landing-page/brack-logo-transparent-bg-orange-text.png"
      alt="Brack"
      width={854}
      height={229}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className="pointer-events-none h-full w-full select-none object-contain"
    />
  </span>
);
