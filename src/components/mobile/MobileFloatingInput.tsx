import { forwardRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface MobileFloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export const MobileFloatingInput = forwardRef<HTMLInputElement, MobileFloatingInputProps>(
  ({ label, error, helperText, className, value, onChange, onFocus, onBlur, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(false);

    useEffect(() => {
      setHasValue(!!(value && value.toString().length > 0));
    }, [value]);

    const isFloating = isFocused || hasValue;

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(!!e.target.value);
      onChange?.(e);
    };

    return (
      <div className="relative space-y-0">
        <div className="relative">
          <Input
            ref={ref}
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={cn(
              "min-h-[56px] text-base pt-6 pb-2",
              "focus:ring-2 focus:ring-primary focus:ring-offset-0",
              error && "border-destructive focus:ring-destructive",
              className
            )}
            placeholder={isFloating ? props.placeholder : ""}
            {...props}
          />
          <Label
            htmlFor={props.id}
            className={cn(
              "absolute left-3 transition-all duration-200 pointer-events-none",
              isFloating
                ? "top-2 text-xs text-muted-foreground"
                : "top-1/2 -translate-y-1/2 text-base text-muted-foreground",
              error && "text-destructive",
              isFloating && error && "text-destructive"
            )}
          >
            {label}
            {props.required && <span className="text-destructive ml-1">*</span>}
          </Label>
        </div>
        {error && (
          <p className="text-sm text-destructive mt-1 px-3">{error}</p>
        )}
        {helperText && !error && (
          <p className="text-sm text-muted-foreground mt-1 px-3">{helperText}</p>
        )}
      </div>
    );
  }
);

MobileFloatingInput.displayName = "MobileFloatingInput";
