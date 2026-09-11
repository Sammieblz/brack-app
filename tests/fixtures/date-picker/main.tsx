import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DatePicker } from '@/components/ui/date-picker';
import { MobileDatePicker } from '@/components/mobile/MobileDatePicker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import '@/index.css';

const params = new URLSearchParams(window.location.search);
const locale = params.get('locale') ?? 'en-US';
const scenario = params.get('scenario') ?? 'standard';
const initialDate = params.has('date') ? params.get('date') || null : '1999-02-05';
const today = '2026-09-11';

document.documentElement.lang = locale;
document.documentElement.classList.toggle('dark', params.get('theme') === 'dark');
if (params.get('text') === '200') document.documentElement.style.fontSize = '32px';

export const DatePickerFixture = () => {
  const [value, setValue] = useState<string | null>(initialDate);
  const [endDate, setEndDate] = useState<string | null>('2026-09-10');
  const [valid, setValid] = useState(true);
  const [endValid, setEndValid] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const isBirthDate = scenario === 'birth-date';
  const isBook = scenario === 'book';
  const label = isBirthDate ? 'Date of birth' : isBook ? 'Started reading' : 'Reading date';

  const form = (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && endValid) setSaved(value ?? 'empty');
      }}
    >
      {scenario === 'native' ? (
        <MobileDatePicker
          id="reading-date"
          label={label}
          value={value ?? ''}
          onChange={(event) => setValue(event.currentTarget.value || null)}
        />
      ) : (
        <DatePicker
          id="reading-date"
          label={label}
          locale={locale}
          value={value}
          onChange={setValue}
          onValidityChange={setValid}
          maxDate={isBirthDate ? today : isBook ? endDate ?? today : undefined}
          showToday={!isBirthDate}
          required={params.get('required') === '1'}
          disabled={params.get('disabled') === '1'}
        />
      )}
      {isBook && (
        <DatePicker
          id="finished-date"
          label="Finished reading"
          locale={locale}
          value={endDate}
          minDate={value}
          maxDate={today}
          onChange={setEndDate}
          onValidityChange={setEndValid}
        />
      )}
      <Button type="submit" disabled={!valid || !endValid}>Save reading dates</Button>
    </form>
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-lg space-y-6 bg-background px-4 py-6 text-foreground">
      <h1 data-testid="fixture-heading" className="font-display text-2xl font-bold">Reading dates</h1>
      {scenario === 'nested' ? (
        <Dialog>
          <DialogTrigger asChild><Button>Edit reading goal</Button></DialogTrigger>
          <DialogContent>
            <DialogTitle>Edit reading goal</DialogTitle>
            <DialogDescription>Choose a reading deadline.</DialogDescription>
            {form}
          </DialogContent>
        </Dialog>
      ) : form}
      <section aria-label="Fixture observations" className="space-y-2 break-words text-sm">
        <p>Committed date: <output data-testid="committed-date">{value ?? 'empty'}</output></p>
        <p>Finished date: <output data-testid="finished-date">{endDate ?? 'empty'}</output></p>
        <p>Saved date: <output data-testid="saved-date">{saved ?? 'not saved'}</output></p>
      </section>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><DatePickerFixture /></React.StrictMode>,
);
