import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon, Xmark } from "iconoir-react";
import { Label } from "@/components/ui/label";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { AdaptiveDialogContent, AdaptiveDialogDescription, AdaptiveDialogTitle } from "@/components/ui/adaptive-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUIEnvironment } from "@/hooks/useUIEnvironment";
import { useOverlayViewport } from "@/hooks/useOverlayViewport";
import { prefersSheetPresentation } from "@/lib/overlayViewport";
import { getDateInputFormat, normalizeDateOnly, todayDateOnly, toLocalDate, validateDateOnly, type DateOnlyInput } from "@/lib/dateOnly";
import { cn } from "@/lib/utils";
import { DatePickerCalendar } from "./date-picker-calendar";
import { getDatePickerLabels, type DatePickerLabels } from "./date-picker-labels";
import "./date-picker.css";

interface DatePickerProps {
  id?: string;
  label?: string;
  value?: DateOnlyInput;
  onChange: (value: string | null, date?: Date) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
  minDate?: DateOnlyInput;
  maxDate?: DateOnlyInput;
  required?: boolean;
  showToday?: boolean;
  locale?: string;
  labels?: Partial<DatePickerLabels>;
  /** Invalid drafts never replace the committed value. Gate the owning form with this callback. */
  onValidityChange?: (valid: boolean) => void;
}

const actionClass = "min-h-[44px] min-w-[44px] rounded-md px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50";

export const DatePicker = ({
  id, label, value, onChange, placeholder, disabled, allowClear = true, className,
  minDate, maxDate, required = false, showToday = false, locale, labels: labelOverrides, onValidityChange,
}: DatePickerProps) => {
  const generatedId = useId();
  const inputId = id ?? `date-${generatedId}`;
  const hintId = `${inputId}-format`;
  const errorId = `${inputId}-error`;
  const selectionId = `${inputId}-selection`;
  const titleId = `${inputId}-title`;
  const helpId = `${inputId}-help`;
  const format = useMemo(() => getDateInputFormat(locale), [locale]);
  const labels = { ...getDatePickerLabels(format.locale), ...labelOverrides };
  const selected = normalizeDateOnly(value);
  const mustHaveDate = required || !allowClear;
  const minimum = normalizeDateOnly(minDate) ?? undefined;
  const maximum = normalizeDateOnly(maxDate) ?? undefined;
  const [draft, setDraft] = useState(() => selected ? format.format(selected) : String(value ?? ""));
  const [touched, setTouched] = useState(false);
  const [open, setOpen] = useState(false);
  const environment = useUIEnvironment();
  const viewport = useOverlayViewport();
  // Keep one primitive/focus scope mounted throughout an open interaction.
  // Reconsider its family on the next opening, after focus has returned.
  const [presentation, setPresentation] = useState(() => prefersSheetPresentation(environment) ? "dialog" : "popover");
  const [scrollWholePanel, setScrollWholePanel] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelElement, setPanelElement] = useState<HTMLDivElement | null>(null);
  const attachPanel = useCallback((element: HTMLDivElement | null) => {
    panelRef.current = element;
    setPanelElement(element);
  }, []);
  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null | undefined>(undefined);
  const previousFormat = useRef(format);
  const previousValidity = useRef<boolean>();
  const changeOpen = (next: boolean) => {
    if (next && !open) setPresentation(prefersSheetPresentation(environment) ? "dialog" : "popover");
    setOpen(next);
  };

  useEffect(() => {
    // An echo of our own keystroke must not reformat the field or move its caret.
    if (emitted.current !== selected || previousFormat.current !== format) {
      setDraft(selected ? format.format(selected) : String(value ?? ""));
      setTouched(false);
    }
    emitted.current = undefined;
    previousFormat.current = format;
  }, [value, selected, format]);

  const parsed = format.parse(draft);
  const validation = parsed.kind === "valid" || parsed.kind === "empty"
    ? validateDateOnly(parsed.kind === "valid" ? parsed.value : null, { min: minimum, max: maximum, required: mustHaveDate })
    : parsed.kind;
  let error = "";
  if (validation === "required") error = labels.required;
  else if (validation === "min") error = `${labels.minimum} ${format.format(minimum!)}.`;
  else if (validation === "max") error = `${labels.maximum} ${format.format(maximum!)}.`;
  else if (validation === "incomplete") error = labels.incomplete;
  else if (validation === "format") error = `${labels.useFormat} (${format.hint})`;
  else if (validation) error = labels.invalid;
  const valid = !error;
  const invalidStoredValue = !!value && !!validateDateOnly(value, { min: minimum, max: maximum });
  const showError = !!error && (touched || invalidStoredValue);

  useEffect(() => {
    inputRef.current?.setCustomValidity(error);
    if (previousValidity.current !== valid) {
      previousValidity.current = valid;
      onValidityChange?.(valid);
    }
  }, [error, valid, onValidityChange]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelElement;
    const header = headerRef.current;
    const footer = footerRef.current;
    if (!panel || !header || !footer) return;
    // Keep calendar actions visible when they fit. With extreme text/viewport
    // constraints, use one whole-panel scroller instead of clipping controls.
    const measure = () => {
      if (panel.clientHeight > 0) {
        setScrollWholePanel(header.offsetHeight + footer.offsetHeight + 44 > panel.clientHeight);
      }
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    for (const element of [panel, header, footer]) observer?.observe(element);
    return () => {
      observer?.disconnect();
    };
  }, [open, panelElement, viewport.height, viewport.width]);

  const emit = (next: string | null) => {
    emitted.current = next;
    onChange(next, toLocalDate(next));
  };
  const commit = (next: string | null) => {
    setDraft(next ? format.format(next) : "");
    setTouched(false);
    emit(next);
    setOpen(false);
  };
  const today = todayDateOnly();
  const initialDate = selected && !validateDateOnly(selected, { min: minimum, max: maximum })
    ? selected : minimum && today < minimum ? minimum : maximum && today > maximum ? maximum : today;
  const title = label ? `${labels.chooseDate}: ${label}` : labels.chooseDate;
  const focusCalendar = (event: Event) => {
    event.preventDefault();
    const day = panelRef.current?.querySelector<HTMLButtonElement>('[role="grid"] button[tabindex="0"]');
    (day ?? panelRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)"))?.focus();
  };
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    triggerRef.current?.focus();
  };
  const trigger = (
    <button ref={triggerRef} type="button" disabled={disabled} aria-label={title} aria-describedby={selectionId}
      className={cn(actionClass, "shrink-0 rounded-l-none border-l border-input text-primary")}>
      <CalendarIcon aria-hidden="true" className="h-5 w-5" />
    </button>
  );
  const panel = (
    <>
      <div ref={headerRef} className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-2 py-1">
        {presentation === "dialog" ? <AdaptiveDialogTitle className="pl-1 font-sans text-base font-semibold">{label ?? labels.chooseDate}</AdaptiveDialogTitle>
          : <h2 id={titleId} className="pl-1 font-sans text-base font-semibold">{label ?? labels.chooseDate}</h2>}
        <button type="button" className={cn(actionClass, "shrink-0 px-2")} aria-label={labels.close} onClick={() => setOpen(false)}>
          <Xmark aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      <div className="date-picker-body min-h-0 overflow-y-auto overscroll-contain px-[4px] py-2">
        <DatePickerCalendar selected={selected} initialDate={initialDate} min={minimum} max={maximum}
          locale={format.locale} labels={labels} onSelect={commit} />
        {presentation === "dialog" ? <AdaptiveDialogDescription className="sr-only">{labels.help} {labels.browseHelp}</AdaptiveDialogDescription>
          : <p id={helpId} className="sr-only">{labels.help} {labels.browseHelp}</p>}
      </div>
      <div ref={footerRef} className="flex shrink-0 flex-wrap items-center justify-end gap-1 border-t border-border px-1 pt-1 pb-[max(4px,env(safe-area-inset-bottom))]">
        {allowClear && !required && <button type="button" className={cn(actionClass, "mr-auto")} onClick={() => commit(null)}>{labels.clear}</button>}
        {showToday && !validateDateOnly(today, { min: minimum, max: maximum }) && (
          <button type="button" className={actionClass} onClick={() => commit(today)}>{labels.today}</button>
        )}
        <button type="button" className={actionClass} onClick={() => setOpen(false)}>{labels.cancel}</button>
      </div>
    </>
  );

  return (
    <div data-date-picker className={cn("space-y-2", className)}>
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <span id={selectionId} className="sr-only">{selected ? format.format(selected) : format.hint}</span>
      <div className={cn("flex min-h-[44px] rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2", disabled && "opacity-50")}>
        <input ref={inputRef} id={inputId} type="text" inputMode="text" autoComplete="off" disabled={disabled}
          aria-label={label ? undefined : labels.chooseDate} aria-describedby={`${hintId}${showError ? ` ${errorId}` : ""}`}
          aria-invalid={showError} aria-required={mustHaveDate} required={mustHaveDate}
          value={draft} placeholder={placeholder ?? format.hint}
          className="min-h-[44px] min-w-0 flex-1 rounded-l-lg bg-transparent px-3 py-2 font-sans text-base text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          onChange={(event) => {
            const next = event.currentTarget.value;
            setDraft(next);
            const result = format.parse(next);
            if (result.kind === "valid" && !validateDateOnly(result.value, { min: minimum, max: maximum })) emit(result.value);
            else if (result.kind === "empty" && !required && allowClear) emit(null);
          }}
          onBlur={() => {
            setTouched(true);
            if (parsed.kind === "valid" && valid) setDraft(format.format(parsed.value));
          }}
          onInvalid={() => setTouched(true)}
          onKeyDown={(event) => {
            if (event.altKey && event.key === "ArrowDown") { event.preventDefault(); changeOpen(true); }
          }}
        />
        {presentation === "dialog" ? (
          <Dialog open={open} onOpenChange={changeOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <AdaptiveDialogContent ref={attachPanel} data-date-picker data-date-picker-presentation="dialog"
              data-scroll-whole-panel={scrollWholePanel} size="compact" showClose={false} disableHaptic
              aria-label={title} aria-labelledby={undefined} onOpenAutoFocus={focusCalendar} onCloseAutoFocus={restoreFocus}
              className="font-sans outline-none">
              {panel}
            </AdaptiveDialogContent>
          </Dialog>
        ) : (
          <Popover modal open={open} onOpenChange={changeOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent ref={attachPanel} data-date-picker data-date-picker-presentation="popover"
              data-scroll-whole-panel={scrollWholePanel} align="end" collisionPadding={4}
              aria-label={title} aria-labelledby={undefined} aria-describedby={helpId}
              onOpenAutoFocus={focusCalendar} onCloseAutoFocus={restoreFocus}
              className="flex w-[360px] max-w-[calc(100vw-8px)] flex-col overflow-hidden p-0 data-[state=open]:animate-none data-[state=closed]:animate-none"
              style={{ maxHeight: `min(var(--radix-popover-content-available-height), ${Math.max(0, viewport.height - 8)}px)` }}>
              {panel}
            </PopoverContent>
          </Popover>
        )}
      </div>
      <p id={hintId} className="font-sans text-xs text-muted-foreground">{labels.format}: {format.hint}</p>
      {showError && <p id={errorId} role="alert" className="font-sans text-sm text-destructive">{error}</p>}
    </div>
  );
};
