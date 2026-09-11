import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { NavArrowLeft, NavArrowRight } from "iconoir-react";
import { useDayPicker, useDayRender, type DayProps } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { normalizeDateOnly, toLocalDate, validateDateOnly } from "@/lib/dateOnly";
import { getCalendarLocale, type DatePickerLabels } from "./date-picker-labels";
import { cn } from "@/lib/utils";

interface DatePickerCalendarProps {
  selected?: string | null;
  initialDate: string;
  min?: string | null;
  max?: string | null;
  locale: string;
  labels: DatePickerLabels;
  onSelect: (value: string) => void;
}

const control = "min-h-[44px] min-w-[44px] rounded-md border border-border bg-background px-2 py-1 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40";
const monthStart = (year: number, month: number) => {
  const date = new Date(0);
  date.setFullYear(year, month, 1);
  date.setHours(12, 0, 0, 0);
  return date;
};

// DayPicker v8 no longer applies labels.labelDay to its default Day renderer.
// Keep its focus/keyboard/selection behavior, adding the full spoken date here.
function AccessibleDay({ date, displayMonth }: DayProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const day = useDayRender(date, displayMonth, ref);
  const { labels, locale } = useDayPicker();
  if (day.isHidden) return <div role="gridcell" />;
  if (!day.isButton) return <div {...day.divProps} />;
  return <button type="button" ref={ref} {...day.buttonProps}
    aria-label={labels.labelDay(date, day.activeModifiers, { locale })} />;
}

export function DatePickerCalendar({ selected, initialDate, min, max, locale, labels, onSelect }: DatePickerCalendarProps) {
  const [month, setMonth] = useState(() => toLocalDate(initialDate) ?? new Date());
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const [decade, setDecade] = useState(() => Math.floor(month.getFullYear() / 10) * 10);
  const navigationRef = useRef<HTMLDivElement>(null);
  const announceId = useId();
  // Navigation is bounded by months. Individual days are compared as civil-date
  // strings, including the rare historical day skipped by a local time zone.
  const [minYear, minMonth] = (min ?? "0001-01-01").split("-").map(Number);
  const [maxYear, maxMonth] = (max ?? "9999-12-31").split("-").map(Number);
  const earliest = monthStart(minYear, minMonth - 1);
  const latest = monthStart(maxYear, maxMonth);
  latest.setDate(0);
  const firstYear = earliest.getFullYear();
  const lastYear = latest.getFullYear();
  const monthName = (date: Date) => new Intl.DateTimeFormat(locale, { calendar: "gregory", month: "long" }).format(date);
  const monthTitle = new Intl.DateTimeFormat(locale, { calendar: "gregory", month: "long", year: "numeric" }).format(month);
  const announcement = view === "years" ? Math.max(1, decade) + " – " + Math.min(9999, decade + 9) : monthTitle;

  useEffect(() => {
    if (view !== "days") {
      const region = navigationRef.current;
      const button = region?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]:not(:disabled)')
        ?? region?.querySelector<HTMLButtonElement>("button:not(:disabled)");
      button?.focus({ preventScroll: true });
    }
  }, [view, decade]);

  const navigateMonth = (offset: number) => setMonth(monthStart(month.getFullYear(), month.getMonth() + offset));
  const chooseView = (next: "months" | "years") => {
    setDecade(Math.floor(month.getFullYear() / 10) * 10);
    setView(next);
  };
  const handleGridKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const current = buttons.indexOf(event.target as HTMLButtonElement);
    if (current < 0) return;
    let next = current;
    if (event.key === "ArrowRight") next++;
    else if (event.key === "ArrowLeft") next--;
    else if (event.key === "ArrowDown") next += 3;
    else if (event.key === "ArrowUp") next -= 3;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else if (event.key === "PageUp" || event.key === "PageDown") {
      const direction = event.key === "PageUp" ? -1 : 1;
      if (view === "years") setDecade((currentDecade) => Math.max(Math.floor(firstYear / 10) * 10, Math.min(Math.floor(lastYear / 10) * 10, currentDecade + direction * 10)));
      else setMonth(monthStart(Math.max(firstYear, Math.min(lastYear, month.getFullYear() + direction)), month.getMonth()));
      event.preventDefault();
      return;
    } else return;
    event.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus();
  };

  const previousDisabled = view === "years" ? decade <= firstYear
    : view === "months" ? month.getFullYear() <= firstYear
      : monthStart(month.getFullYear(), month.getMonth()) <= monthStart(firstYear, earliest.getMonth());
  const nextDisabled = view === "years" ? decade + 9 >= lastYear
    : view === "months" ? month.getFullYear() >= lastYear
      : monthStart(month.getFullYear(), month.getMonth()) >= monthStart(lastYear, latest.getMonth());
  const move = (direction: number) => {
    if (view === "years") setDecade(decade + direction * 10);
    else navigateMonth(direction * (view === "months" ? 12 : 1));
  };

  return (
    <div className="min-w-0 space-y-2 font-sans">
      <p id={announceId} aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</p>
      <div className="flex items-center gap-1">
        <button type="button" className={control} disabled={previousDisabled} onClick={() => move(-1)}
          aria-label={view === "years" ? labels.previousDecade : view === "months" ? labels.previousYear : labels.previousMonth}>
          <NavArrowLeft aria-hidden="true" className="mx-auto h-4 w-4" />
        </button>
        <div className="flex min-w-0 flex-1 flex-wrap justify-center gap-1">
          <button type="button" className={cn(control, "max-w-full flex-auto break-words")} onClick={() => chooseView("months")} aria-label={labels.chooseMonth}>{monthName(month)}</button>
          <button type="button" className={cn(control, "max-w-full break-words")} onClick={() => chooseView("years")} aria-label={labels.chooseYear}>{view === "years" ? announcement : month.getFullYear()}</button>
        </div>
        <button type="button" className={control} disabled={nextDisabled} onClick={() => move(1)}
          aria-label={view === "years" ? labels.nextDecade : view === "months" ? labels.nextYear : labels.nextMonth}>
          <NavArrowRight aria-hidden="true" className="mx-auto h-4 w-4" />
        </button>
      </div>
      {view === "days" ? (
        <Calendar
          mode="single"
          required
          month={month}
          onMonthChange={setMonth}
          selected={toLocalDate(selected)}
          onSelect={(date) => { const value = normalizeDateOnly(date); if (value) onSelect(value); }}
          fromDate={earliest}
          toDate={latest}
          disabled={(date) => !!validateDateOnly(date, { min: min ?? undefined, max: max ?? undefined })}
          locale={getCalendarLocale(locale)}
          initialFocus
          fixedWeeks
          showOutsideDays={false}
          className="w-full p-0"
          classNames={{
            months: "w-full", month: "w-full", caption: "sr-only", caption_label: "sr-only",
            table: "w-full table-fixed border-collapse", head_row: "", row: "",
            head_cell: "h-8 text-center text-xs font-normal text-muted-foreground",
            cell: "p-0 text-center align-middle",
            day: "min-h-[44px] w-full rounded-md p-0 text-sm font-normal hover:bg-accent focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          }}
          components={{ Day: AccessibleDay, Caption: ({ id }) => <span id={id} className="sr-only">{monthTitle}</span> }}
          formatters={{ formatWeekdayName: (date) => new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date) }}
          labels={{
            labelDay: (date) => new Intl.DateTimeFormat(locale, { calendar: "gregory", weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(date),
            labelWeekday: (date) => new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date),
          }}
        />
      ) : (
        <div ref={navigationRef} role="group" aria-label={view === "years" ? labels.chooseYear : labels.chooseMonth}
          className="grid grid-cols-3 gap-2 py-2" onKeyDown={handleGridKeys}>
          {view === "years"
            ? Array.from({ length: 10 }, (_, index) => decade + index).filter((year) => year >= 1 && year <= 9999).map((year) => (
              <button key={year} type="button" className={control}
                aria-pressed={year === month.getFullYear()} disabled={year < firstYear || year > lastYear}
                onClick={() => { setMonth(monthStart(year, month.getMonth())); setView("months"); }}>{year}</button>
            ))
            : Array.from({ length: 12 }, (_, index) => monthStart(month.getFullYear(), index)).map((date) => (
              <button key={date.getMonth()} type="button" className={cn(control, "break-words")}
                aria-pressed={date.getMonth() === month.getMonth()}
                disabled={date < monthStart(firstYear, earliest.getMonth()) || date > monthStart(lastYear, latest.getMonth())}
                onClick={() => { setMonth(date); setView("days"); }}>{monthName(date)}</button>
            ))}
        </div>
      )}
      <p className="sr-only">{view === "days" ? labels.help : labels.browseHelp}</p>
    </div>
  );
}
