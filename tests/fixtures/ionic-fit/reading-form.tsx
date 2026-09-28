import { useEffect, useMemo, useRef, useState } from 'react';
import { DatePickerCalendar } from '@/components/ui/date-picker-calendar';
import { getDatePickerLabels } from '@/components/ui/date-picker-labels';
import { getDateInputFormat, normalizeDateOnly, todayDateOnly, validateDateOnly } from '@/lib/dateOnly';
import '@/components/ui/date-picker.css';

export type ReadingDraft = { title: string; dateText: string; notes: string };
export type SavedReadingDraft = { title: string; date: string | null; notes: string };

interface ReadingFormProps {
  draft: ReadingDraft;
  setDraft: (draft: ReadingDraft) => void;
  saving: boolean;
  error: string | null;
  discardRequested: boolean;
  onSave: (value: SavedReadingDraft) => void;
  onCancel: () => void;
  onDiscard: () => void;
  onKeepEditing: () => void;
}

/**
 * Fixture-only adapter shared by the Radix baseline and Ionic candidate.
 * Query controls: locale (en-US default), required=1, min/max (YYYY-MM-DD).
 * Draft/persistence ownership belongs to the fixture; this adds no overlay or
 * alternate date parser. DatePickerCalendar is deliberately opened inline.
 */
export function ReadingForm({
  draft, setDraft, saving, error, discardRequested,
  onSave, onCancel, onDiscard, onKeepEditing,
}: ReadingFormProps) {
  const options = useMemo(() => {
    const query = new URLSearchParams(window.location.search);
    return {
      format: getDateInputFormat(query.get('locale') ?? 'en-US'),
      required: query.get('required') === '1',
      min: normalizeDateOnly(query.get('min')) ?? undefined,
      max: normalizeDateOnly(query.get('max')) ?? undefined,
    };
  }, []);
  const { format, required, min, max } = options;
  const labels = getDatePickerLabels(format.locale);
  const parsed = format.parse(draft.dateText);
  const parsedDate = parsed.kind === 'valid' ? parsed.value : null;
  const validation = parsed.kind === 'valid' || parsed.kind === 'empty'
    ? validateDateOnly(parsedDate, { required, min, max })
    : parsed.kind;
  const dateValid = !validation;
  const lastValidDate = useRef<string | null>(dateValid ? parsedDate : null);
  const [dateTouched, setDateTouched] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarInitialDate, setCalendarInitialDate] = useState(parsedDate ?? todayDateOnly());
  const calendarTrigger = useRef<HTMLButtonElement>(null);
  const calendarWasOpen = useRef(false);
  const discardHeading = useRef<HTMLHeadingElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const discardWasRequested = useRef(false);

  let dateError = '';
  if (validation === 'required') dateError = labels.required;
  else if (validation === 'min') dateError = `${labels.minimum} ${format.format(min!)}.`;
  else if (validation === 'max') dateError = `${labels.maximum} ${format.format(max!)}.`;
  else if (validation === 'incomplete') dateError = labels.incomplete;
  else if (validation === 'format') dateError = `${labels.useFormat} (${format.hint})`;
  else if (validation) dateError = labels.invalid;
  const showDateError = Boolean(dateError) && (dateTouched || parsed.kind === 'invalid' || parsed.kind === 'format');

  useEffect(() => {
    if (dateValid) lastValidDate.current = parsedDate;
  }, [dateValid, parsedDate]);

  useEffect(() => {
    if (calendarWasOpen.current && !calendarOpen && !discardRequested) {
      calendarTrigger.current?.focus({ preventScroll: true });
    }
    calendarWasOpen.current = calendarOpen;
  }, [calendarOpen, discardRequested]);

  useEffect(() => {
    if (discardRequested) {
      setCalendarOpen(false);
      discardHeading.current?.focus({ preventScroll: true });
    } else if (discardWasRequested.current) {
      heading.current?.focus({ preventScroll: true });
    }
    discardWasRequested.current = discardRequested;
  }, [discardRequested]);

  const openCalendar = () => {
    let initial = dateValid && parsedDate ? parsedDate : lastValidDate.current ?? todayDateOnly();
    if (min && initial < min) initial = min;
    if (max && initial > max) initial = max;
    setCalendarInitialDate(initial);
    setCalendarOpen(true);
  };

  const commitDate = (value: string | null) => {
    setDraft({ ...draft, dateText: value ? format.format(value) : '' });
    setDateTouched(false);
    setCalendarOpen(false);
  };

  return (
    <form
      className="fit-form flex h-full min-h-0 flex-col font-sans text-foreground"
      onSubmit={(event) => {
        event.preventDefault();
        setDateTouched(true);
        if (!saving && !discardRequested && draft.title.trim() && dateValid) {
          onSave({ title: draft.title.trim(), date: parsedDate, notes: draft.notes });
        }
      }}
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape' && calendarOpen) {
          event.preventDefault();
          event.stopPropagation();
          if (!saving) setCalendarOpen(false);
        }
      }}
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border p-4">
        <h2 id="reading-title" ref={heading} tabIndex={-1} className="font-display text-xl">Reading note</h2>
        <button type="button" className="fit-button min-h-11" aria-label="Close reading note" disabled={saving} onClick={onCancel}>Close</button>
      </header>

      <div data-testid="reading-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4" style={{ minHeight: 0, overflowY: 'auto' }}>
        <p id="reading-description" className="mb-5 text-sm text-muted-foreground">
          Keep a passage, a question or a thought from your reading. Choose the day you read it, including dates from years ago. Your note stays here until you save or explicitly discard it.
        </p>

        {discardRequested && (
          <section aria-labelledby="discard-reading-title" className="mb-5 rounded-lg border border-border bg-muted p-4">
            <h3 id="discard-reading-title" ref={discardHeading} tabIndex={-1} className="font-serif text-lg">Discard this reading note?</h3>
            <p className="mt-2 text-sm">Your unsaved title, date and notes will be lost if you discard them.</p>
            <div className="fit-actions mt-3 flex flex-wrap gap-2">
              <button type="button" className="fit-button min-h-11" disabled={saving} onClick={onKeepEditing}>Keep editing</button>
              <button type="button" className="fit-button min-h-11 text-destructive" disabled={saving} onClick={onDiscard}>Discard note</button>
            </div>
          </section>
        )}

        <fieldset disabled={saving || discardRequested} className="min-w-0 space-y-5">
          <div className="fit-field space-y-2">
            <label htmlFor="reading-note-title" className="block font-medium">Title</label>
            <input id="reading-note-title" className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base" required value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.currentTarget.value })} />
          </div>

          <div data-date-picker className="fit-field space-y-2">
            <label htmlFor="reading-date" className="block font-medium">Reading date{required ? ' (required)' : ' (optional)'}</label>
            <input id="reading-date" type="text" inputMode="text" autoComplete="off"
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
              value={draft.dateText} required={required} aria-required={required} aria-invalid={!dateValid}
              aria-describedby={`reading-date-format${showDateError ? ' reading-date-error' : ''}`}
              onChange={(event) => setDraft({ ...draft, dateText: event.currentTarget.value })}
              onBlur={() => setDateTouched(true)} />
            <p id="reading-date-format" className="text-sm text-muted-foreground">{labels.format}: {format.hint}. {labels.useFormat}</p>
            {showDateError && <p id="reading-date-error" role="alert" className="text-sm text-destructive">{dateError}</p>}
            <div className="flex flex-wrap gap-2">
              <button ref={calendarTrigger} type="button" className="fit-button min-h-11" aria-expanded={calendarOpen} aria-controls="reading-calendar" onClick={() => calendarOpen ? setCalendarOpen(false) : openCalendar()}>Choose reading date</button>
              {!required && <button type="button" className="fit-button min-h-11" onClick={() => commitDate(null)}>Clear reading date</button>}
            </div>
            {calendarOpen && (
              <section id="reading-calendar" aria-label="Reading date calendar" className="space-y-3 rounded-lg border border-border bg-popover p-1 text-popover-foreground">
                <DatePickerCalendar selected={dateValid ? parsedDate : lastValidDate.current} initialDate={calendarInitialDate}
                  min={min} max={max} locale={format.locale} labels={labels} onSelect={commitDate} />
                <button type="button" className="fit-button min-h-11" onClick={() => setCalendarOpen(false)}>Close calendar</button>
              </section>
            )}
          </div>

          <div className="fit-field space-y-2">
            <label htmlFor="reading-notes" className="block font-medium">Notes</label>
            <textarea id="reading-notes" rows={5} className="w-full rounded-md border border-input bg-background px-3 py-2 text-base" value={draft.notes}
              aria-describedby="reading-notes-help" onChange={(event) => setDraft({ ...draft, notes: event.currentTarget.value })} />
            <p id="reading-notes-help" className="text-sm text-muted-foreground">Write in your own words. A short line is enough; leave room for a longer reflection when you need it.</p>
          </div>

          <details className="rounded-lg border border-border p-3">
            <summary className="min-h-11 cursor-pointer font-medium">Ideas for your note</summary>
            <p className="mt-3 font-serif text-sm">What stayed with you after this chapter? You might capture a character's decision, an unfamiliar idea, or a detail you want to return to. This section is optional and does not add anything to your saved note.</p>
          </details>
        </fieldset>

        {error && <p id="reading-save-error" role="alert" className="mt-5 text-sm text-destructive">{error}</p>}
        <p role="status" aria-live="polite" className="mt-3 text-sm">{saving ? 'Saving reading note…' : ''}</p>
        <div className="fit-actions mt-5 flex flex-wrap gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="submit" className="fit-button min-h-11" disabled={saving || discardRequested || !dateValid || !draft.title.trim()} aria-describedby={error ? 'reading-save-error' : undefined}>
            {saving ? 'Saving…' : 'Save reading note'}
          </button>
          <button type="button" className="fit-button min-h-11" disabled={saving || discardRequested} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </form>
  );
}
