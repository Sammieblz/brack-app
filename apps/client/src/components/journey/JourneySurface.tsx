import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type JourneySurfaceVariant = "hero" | "flat" | "interactive";

interface JourneySurfaceProps extends HTMLAttributes<HTMLDivElement> {
  variant?: JourneySurfaceVariant;
}

export const JourneySurface = forwardRef<HTMLDivElement, JourneySurfaceProps>(({
  variant = "flat",
  className,
  style,
  ...props
}, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl border text-card-foreground",
      variant === "hero" && "border-primary/[0.24] bg-card shadow-sm",
      variant === "flat" && "border-border/70 bg-card/75",
      variant === "interactive" && [
        "border-border/70 bg-card transition-[border-color,box-shadow,transform]",
        "hover:-translate-y-0.5 hover:border-primary/[0.38] hover:shadow-md",
        "focus-within:border-primary focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        "motion-reduce:transform-none motion-reduce:transition-none",
      ],
      className,
    )}
    style={{
      ...(variant === "hero"
        ? {
            backgroundImage:
              "radial-gradient(circle at top right, color-mix(in srgb, hsl(var(--primary)) 18%, transparent), transparent 48%)",
          }
        : {}),
      ...style,
    }}
    {...props}
  />
));

JourneySurface.displayName = "JourneySurface";

export const JourneySectionEyebrow = ({ children }: { children: ReactNode }) => (
  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
    {children}
  </p>
);

export const JourneyInlineEmpty = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="mt-4 rounded-xl border border-dashed border-border/70 bg-background/40 p-5">
    <p className="font-medium">{title}</p>
    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
  </div>
);
