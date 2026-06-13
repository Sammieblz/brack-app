import { useMemo, useState } from "react";
import { Clock, Xmark } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  id?: string;
  label?: string;
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
}

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);

const pad = (value: number) => String(value).padStart(2, "0");

const parseTimeValue = (value?: string | null) => {
  if (!value) return null;

  const [hourPart, minutePart] = value.split(":");
  const hour24 = Number(hourPart);
  const minute = Number(minutePart);

  if (!Number.isFinite(hour24) || !Number.isFinite(minute)) return null;
  if (hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) return null;

  return {
    hour24,
    minute,
    period: hour24 >= 12 ? "PM" : "AM",
    hour12: hour24 % 12 === 0 ? 12 : hour24 % 12,
  };
};

const formatTimeValue = (hour12: number, minute: number, period: "AM" | "PM") => {
  const normalizedHour = hour12 === 12 ? 0 : hour12;
  const hour24 = period === "PM" ? normalizedHour + 12 : normalizedHour;
  return `${pad(hour24)}:${pad(minute)}`;
};

const getDisplayValue = (value?: string | null) => {
  const parsed = parseTimeValue(value);
  if (!parsed) return null;
  return `${parsed.hour12}:${pad(parsed.minute)} ${parsed.period}`;
};

export const TimePicker = ({
  id,
  label,
  value,
  onChange,
  placeholder = "Pick time",
  disabled,
  allowClear = false,
  className,
}: TimePickerProps) => {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseTimeValue(value) ?? parseTimeValue("19:00")!, [value]);
  const displayValue = getDisplayValue(value);

  const setTime = (updates: Partial<{ hour12: number; minute: number; period: "AM" | "PM" }>) => {
    onChange(
      formatTimeValue(
        updates.hour12 ?? parsed.hour12,
        updates.minute ?? parsed.minute,
        updates.period ?? parsed.period,
      ),
    );
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
              !displayValue && "text-muted-foreground",
            )}
          >
            <Clock className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 truncate">{displayValue ?? placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[20rem] p-3">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="font-sans text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Hour
              </p>
              <div className="grid grid-cols-6 gap-1.5">
                {HOURS.map((hour) => (
                  <Button
                    key={hour}
                    type="button"
                    variant={parsed.hour12 === hour ? "default" : "outline"}
                    size="sm"
                    className="h-9 px-0"
                    onClick={() => setTime({ hour12: hour })}
                  >
                    {hour}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-sans text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Minute
              </p>
              <div className="grid grid-cols-6 gap-1.5">
                {MINUTES.map((minute) => (
                  <Button
                    key={minute}
                    type="button"
                    variant={parsed.minute === minute ? "default" : "outline"}
                    size="sm"
                    className="h-9 px-0"
                    onClick={() => setTime({ minute })}
                  >
                    {pad(minute)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(["AM", "PM"] as const).map((period) => (
                <Button
                  key={period}
                  type="button"
                  variant={parsed.period === period ? "default" : "outline"}
                  onClick={() => {
                    setTime({ period });
                    setOpen(false);
                  }}
                >
                  {period}
                </Button>
              ))}
            </div>

            {allowClear && value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Xmark className="mr-2 h-4 w-4" />
                Clear time
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
