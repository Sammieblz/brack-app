import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface MobileDatePickerProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const MobileDatePicker = forwardRef<HTMLInputElement, MobileDatePickerProps>(
  ({ label, error, helperText, className, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <Label htmlFor={props.id} className="text-sm font-medium">
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
        />
        {error && (
          <p className="font-sans text-sm text-destructive">{error}</p>
        )}
        {helperText && !error && (
          <p className="font-sans text-sm text-muted-foreground">{helperText}</p>
        )}
      </div>
    );
  }
);

MobileDatePicker.displayName = "MobileDatePicker";
