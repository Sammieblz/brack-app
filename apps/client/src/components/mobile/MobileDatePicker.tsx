import { forwardRef, useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import "@/components/ui/date-picker.css";

interface MobileDatePickerProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const MobileDatePicker = forwardRef<HTMLInputElement, MobileDatePickerProps>(
  ({ label, error, helperText, className, ...props }, ref) => {
    const generatedId = useId();
    const id = props.id ?? `native-date-${generatedId}`;
    const descriptionId = `${id}-description`;
    return (
      <div data-date-picker className="space-y-2">
        {label && (
          <Label htmlFor={id} className="text-sm font-medium">
            {label}
          </Label>
        )}
        <Input
          ref={ref}
          type="date"
          className={cn(
            "min-h-[44px] text-base", // Minimum touch target size for mobile
            "focus:ring-2 focus:ring-primary focus:ring-offset-2",
            error && "border-destructive focus:ring-destructive",
            className
          )}
          {...props}
          id={id}
          aria-label={props["aria-label"] ?? label}
          aria-invalid={!!error || props["aria-invalid"]}
          aria-describedby={[props["aria-describedby"], (error || helperText) && descriptionId].filter(Boolean).join(" ") || undefined}
        />
        {error && (
          <p id={descriptionId} role="alert" className="font-sans text-sm text-destructive">{error}</p>
        )}
        {helperText && !error && (
          <p id={descriptionId} className="font-sans text-sm text-muted-foreground">{helperText}</p>
        )}
      </div>
    );
  }
);

MobileDatePicker.displayName = "MobileDatePicker";
