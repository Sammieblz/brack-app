import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JournalEntriesList } from '@/components/JournalEntriesList';
import { QuickJournalEntryDialog } from '@/components/QuickJournalEntryDialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { ConfirmDialogProvider } from '@/contexts/ConfirmDialogContext';
import { bookId, registerFixtureRemount } from './state';
import '@/index.css';

export function JournalSaveFixture() {
  const [quickOpen, setQuickOpen] = useState(false);
  const [mountVersion, setMountVersion] = useState(0);
  useEffect(() => { registerFixtureRemount(() => setMountVersion((version) => version + 1)); }, []);
  return <main className="mx-auto min-h-screen max-w-3xl space-y-6 bg-background p-4 text-foreground sm:p-8">
    <header>
      <h1 className="font-display text-2xl">Journal save regression fixture</h1>
      <p className="text-sm text-muted-foreground">Local synthetic writing. Saves never contact an account or backend.</p>
    </header>
    <section key={mountVersion} aria-label="Book journal"><JournalEntriesList bookId={bookId} /></section>
    <button type="button" className="min-h-11 rounded border px-4" onClick={() => setQuickOpen(true)}>Open quick journal</button>
    {quickOpen && <QuickJournalEntryDialog key={mountVersion} open={quickOpen} onOpenChange={setQuickOpen} bookId={bookId} bookTitle="Fixture book" />}
  </main>;
}

createRoot(document.getElementById('root')!).render(
  <TooltipProvider><ConfirmDialogProvider><JournalSaveFixture /><Toaster /></ConfirmDialogProvider></TooltipProvider>
);
