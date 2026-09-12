import {
  BrackLoader,
  type BrackLoaderVariant,
} from "@/components/animations/LogoSpinner";

interface LoadingSpinnerProps {
  active?: boolean;
  variant?: BrackLoaderVariant;
  size?: "sm" | "md" | "lg";
  text?: string;
  progress?: number;
  delayMs?: number;
  className?: string;
}

/**
 * @deprecated Use BrackLoader or BrandedLoadingScreen for focused blocking work.
 * Preserve card and list geometry with their existing skeletons instead.
 */
const LoadingSpinner = ({
  active = true,
  variant = "inline",
  size = "md",
  text = "Loading...",
  progress,
  delayMs,
  className,
}: LoadingSpinnerProps) => (
  <BrackLoader
    active={active}
    variant={variant}
    size={size}
    label={text}
    progress={progress}
    delayMs={delayMs}
    className={className}
  />
);

export default LoadingSpinner;
