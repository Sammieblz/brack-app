import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Xmark } from "iconoir-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DatePickerValue = Date | string | null | undefined;

interface DatePickerProps {
  id?: string;
  label?: string;
  value?: DatePickerValue;
  onChange: (value: string | null, date?: Date) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
}

const parseDateValue = (value: DatePickerValue) => {
  if (!value) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const toDateValue = (date: Date) => format(date, "yyyy-MM-dd");

export const DatePicker = ({
  id,
  label,
  value,
  onChange,
  placeholder = "Pick date",
  disabled,
  allowClear = true,
  className,
}: DatePickerProps) => {
  const [open, setOpen] = useState(false);
  const selectedDate = useMemo(() => parseDateValue(value), [value]);

  const handleSelect = (date?: Date) => {
    onChange(date ? toDateValue(date) : null, date);
    if (date) setOpen(false);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "min-h-11 w-full justify-start gap-2 rounded-lg px-3 text-left font-sans font-normal",
              !selectedDate && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 truncate">
              {selectedDate ? format(selectedDate, "MMM d, yyyy") : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            initialFocus
          />
          {allowClear && selectedDate && (
            <div className="border-t border-border p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={() => {
                  onChange(null, undefined);
                  setOpen(false);
                }}
              >
                <Xmark className="mr-2 h-4 w-4" />
                Clear date
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};
