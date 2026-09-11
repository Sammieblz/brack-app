import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { LibraryBookCard } from '@/components/LibraryBookCard';
import { LibraryBookshelfView } from '@/components/library/LibraryBookshelfView';
import { LibraryCarouselView } from '@/components/library/LibraryCarouselView';
import { LIBRARY_FLAT_GRID } from '@/components/library/libraryLayout';
import { SwipeableBookCard } from '@/components/SwipeableBookCard';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfirmDialogProvider } from '@/contexts/ConfirmDialogContext';
import { getTheme, themes } from '@/lib/themes';
import type { Book } from '@/types';
import '@/index.css';

type FixtureEvent = { action: string; id: string };
declare global {
  interface Window {
    libraryEvents: FixtureEvent[];
    libraryFixture: { reset: () => void; setTheme: (id: string, dark: boolean) => void; themes: string[] };
  }
}

const params = new URLSearchParams(window.location.search);
const view = params.get('view') ?? 'flat';
const selectMode = params.get('select') === '1';
const reorderMode = params.get('reorder') === '1';
const long = params.get('long') === '1';
const cover = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="270"><rect width="180" height="270" fill="#864832"/><path d="M12 0v270" stroke="#c4a277" stroke-width="4"/><text x="92" y="105" text-anchor="middle" fill="#fff2de" font-family="serif" font-size="24">Open Water</text></svg>')}`;
const date = '2026-09-11T12:00:00Z';
const initialBooks: Book[] = Array.from({ length: 8 }, (_, index) => ({
  id: `fixture-book-${index}`, user_id: 'fixture-reader',
  title: index === 0 ? (long ? 'Open Water: A Long Reading Record of Places, People, and the Things We Remember' : 'Open Water') : `Shelf book ${index + 1}`,
  author: index === 0 ? 'Caleb Azumah Nelson' : 'A. Reader', isbn: '9780000000000',
  genre: 'Fiction', pages: 120, chapters: 12, cover_url: index === 1 ? null : cover,
  description: 'A reading record with enough context to test the expanded book details.',
  status: 'reading', tags: ['Reading circle', 'Favourite'], metadata: null, current_page: 36,
  date_started: date, date_finished: null, rating: null, notes: 'A note worth coming back to.',
  source_provider: null, source_id: null, shelf_position: index, created_at: date, updated_at: date, deleted_at: null,
}));
window.libraryEvents = [];

function setTheme(id: string, dark: boolean) {
  const theme = getTheme(id);
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.dataset.brackThemeStyle = theme.surfaceStyle ?? 'standard';
  themes.forEach((item) => { if (item.surfaceStyle) root.classList.remove(`brack-theme-${item.surfaceStyle}`); });
  root.classList.add(`brack-theme-${theme.surfaceStyle ?? 'standard'}`);
  Object.entries(dark ? theme.colors.dark : theme.colors.light).forEach(([key, value]) => {
    root.style.setProperty(`--${key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/chart(\d+)/g, 'chart-$1')}`, value);
  });
}
setTheme(params.get('theme') ?? 'default', params.get('dark') === '1');

export function LibraryInteractionFixture() {
  const navigate = useNavigate();
  const location = useLocation();
  const [books, setBooks] = useState(initialBooks);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [eventVersion, setEventVersion] = useState(0);
  const record = (action: string, id: string) => {
    window.libraryEvents.push({ action, id });
    setEventVersion((version) => version + 1);
  };

  useEffect(() => {
    window.libraryFixture = {
      reset: () => {
        window.libraryEvents = [];
        setEventVersion((version) => version + 1);
        setSelectedBookIds([]);
        setBooks(initialBooks);
        navigate('/library');
      },
      setTheme,
      themes: themes.map((theme) => theme.id),
    };
  }, [navigate]);

  const actions = {
    onView: (id: string) => { record('view', id); navigate(`/book/${id}`); },
    onEdit: (id: string) => { record('edit', id); navigate(`/edit-book/${id}`); },
    onDelete: (id: string) => { record('delete', id); },
    onToggleSelect: (id: string) => {
      record('select', id);
      setSelectedBookIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    },
  };
  const renderCard = (book: Book) => (
    <LibraryBookCard key={book.id} book={book} selectMode={selectMode} selected={selectedBookIds.includes(book.id)} {...actions} />
  );

  return <main className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border p-4">
      <h1 className="font-display text-2xl">My Library</h1>
      <p className="font-sans text-sm text-muted-foreground">Local interaction fixture. No account or external data.</p>
    </header>
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">
      <div data-testid="library">
        {view === 'bookshelf' ? <LibraryBookshelfView books={books} selectMode={selectMode} selectedBookIds={selectedBookIds} reorderMode={reorderMode}
          onReorder={(ordered) => { record('reorder', ordered.map((book) => book.id).join(',')); setBooks(ordered); }} {...actions} /> :
          view === 'carousel' ? <LibraryCarouselView books={books} selectMode={selectMode} selectedBookIds={selectedBookIds} {...actions} /> :
            <div className={LIBRARY_FLAT_GRID}>{books.map((book) => params.get('swipe') === '1' ?
              <SwipeableBookCard key={book.id} book={book} {...actions} onStatusChange={(id) => record('status', id)}>{renderCard(book)}</SwipeableBookCard> : renderCard(book))}</div>}
      </div>
      <div className="border-t border-border pt-4 font-mono text-xs">
        <output data-testid="events" data-version={eventVersion}>{JSON.stringify(window.libraryEvents)}</output>
        <output data-testid="path" className="block">{location.pathname}</output>
        <output data-testid="book-order" className="block">{books.map((book) => book.id).join(',')}</output>
        <output data-testid="selection" className="block">{selectedBookIds.join(',')}</output>
      </div>
      <div className="h-[400px]" aria-hidden="true" />
    </div>
  </main>;
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/library']}><TooltipProvider><ConfirmDialogProvider><LibraryInteractionFixture /></ConfirmDialogProvider></TooltipProvider></MemoryRouter>
);
