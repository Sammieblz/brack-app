import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface MobileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const MobileInput = forwardRef<HTMLInputElement, MobileInputProps>(
  ({ label, error, helperText, className, type, ...props }, ref) => {
    // Determine inputMode based on type for better mobile keyboards
    const getInputMode = () => {
      if (type === "url") return "url";
      if (type === "email") return "email";
      if (type === "tel") return "tel";
      if (type === "number" || props.inputMode === "numeric") return "numeric";
      return undefined;
    };

    return (
      <div className="space-y-2">
        {label && (
          <Label htmlFor={props.id} className="text-sm font-medium">
            {label}
          </Label>
        )}
        <Input
          ref={ref}
          type={type}
          inputMode={getInputMode()}
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

MobileInput.displayName = "MobileInput";
