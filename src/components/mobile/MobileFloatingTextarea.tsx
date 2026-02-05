import { forwardRef, useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface MobileFloatingTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export const MobileFloatingTextarea = forwardRef<HTMLTextAreaElement, MobileFloatingTextareaProps>(
  ({ label, error, helperText, className, value, onChange, onFocus, onBlur, rows = 4, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(false);

    useEffect(() => {
      setHasValue(!!(value && value.toString().length > 0));
    }, [value]);

    const isFloating = isFocused || hasValue;

    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setHasValue(!!e.target.value);
      onChange?.(e);
    };

    return (
      <div className="relative space-y-0">
        <div className="relative">
          <Textarea
            ref={ref}
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            rows={rows}
            className={cn(
              "min-h-[120px] text-base pt-6 pb-2 resize-none",
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
              "absolute left-3 top-3 transition-all duration-200 pointer-events-none",
              isFloating
                ? "text-xs text-muted-foreground"
                : "text-base text-muted-foreground",
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

MobileFloatingTextarea.displayName = "MobileFloatingTextarea";
