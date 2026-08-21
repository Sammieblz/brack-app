import type { ImgHTMLAttributes } from "react";
import { BRACK_CURRENCY_IMAGES } from "@/config/brackAssets";
import { cn } from "@/lib/utils";

export type BrackCurrency = keyof typeof BRACK_CURRENCY_IMAGES;
export type CurrencyIconSize = "xs" | "sm" | "md" | "lg" | "xl";

interface CurrencyIconProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "alt" | "src"> {
  currency: BrackCurrency;
  size?: CurrencyIconSize;
  label?: string;
  decorative?: boolean;
}

const sizeClasses: Record<CurrencyIconSize, string> = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

const defaultLabels: Record<BrackCurrency, string> = {
  ink: "Ink",
  goldLeaves: "Gold Leaves",
};

export const CurrencyIcon = ({
  currency,
  size = "sm",
  label,
  decorative = !label,
  className,
  ...props
}: CurrencyIconProps) => (
  <img
    src={BRACK_CURRENCY_IMAGES[currency]}
    alt={decorative ? "" : label ?? defaultLabels[currency]}
    aria-hidden={decorative ? true : undefined}
    className={cn("inline-block shrink-0 object-contain", sizeClasses[size], className)}
    decoding="async"
    draggable={false}
    {...props}
  />
);
