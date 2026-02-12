import { forwardRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface MobileSelectProps extends React.ComponentPropsWithoutRef<typeof SelectTrigger> {
  label?: string;
  error?: string;
  helperText?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export const MobileSelect = forwardRef<
  React.ElementRef<typeof SelectTrigger>,
  MobileSelectProps & { onValueChange?: (value: string) => void; value?: string }
>(({ label, error, helperText, options, placeholder, className, ...props }, ref) => {
  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={props.id} className="text-sm font-medium">
          {label}
        </Label>
      )}
      <Select {...props}>
        <SelectTrigger
          ref={ref}
          className={cn(
            "min-h-[44px] text-base", // Minimum touch target size for mobile
            "focus:ring-2 focus:ring-primary focus:ring-offset-2",
            error && "border-destructive focus:ring-destructive",
            className
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="min-h-[44px]">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
});

MobileSelect.displayName = "MobileSelect";
