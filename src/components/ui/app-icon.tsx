import type { HTMLAttributes } from "react";
import type { AppIcon as IconComponent } from "@/config/iconography";
import { cn } from "@/lib/utils";

export type AppIconVariant = "inline" | "action" | "status" | "empty" | "brand";
export type AppIconSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AppIconProps extends HTMLAttributes<HTMLSpanElement> {
  icon: IconComponent;
  variant?: AppIconVariant;
  size?: AppIconSize;
  label?: string;
  decorative?: boolean;
}

const variantClasses: Record<AppIconVariant, string> = {
  inline: "inline-flex shrink-0 items-center justify-center text-current",
  action: "inline-flex shrink-0 items-center justify-center text-current",
  status: "inline-flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
  empty: "inline-flex shrink-0 items-center justify-center text-muted-foreground/70",
  brand: "inline-flex shrink-0 items-center justify-center text-primary",
};

const sizeClasses: Record<AppIconSize, string> = {
  xs: "[&_svg]:h-3.5 [&_svg]:w-3.5",
  sm: "[&_svg]:h-4 [&_svg]:w-4",
  md: "[&_svg]:h-5 [&_svg]:w-5",
  lg: "[&_svg]:h-8 [&_svg]:w-8",
  xl: "[&_svg]:h-10 [&_svg]:w-10",
};

const statusSizeClasses: Record<AppIconSize, string> = {
  xs: "h-6 w-6",
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-12 w-12",
};

export const AppIcon = ({
  icon: Icon,
  variant = "inline",
  size = variant === "empty" ? "lg" : "sm",
  className,
  label,
  decorative = !label,
  ...props
}: AppIconProps) => (
  <span
    aria-hidden={decorative ? true : undefined}
    aria-label={!decorative ? label : undefined}
    role={!decorative ? "img" : undefined}
    className={cn(
      variantClasses[variant],
      sizeClasses[size],
      variant === "status" && statusSizeClasses[size],
      className,
    )}
    {...props}
  >
    <Icon />
  </span>
);
