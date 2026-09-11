import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LibraryModeCase } from './library-cases';
import { LibraryViewSkeleton } from '@/components/skeletons/LibraryViewSkeleton';
import { PostCard } from '@/components/social/PostCard';
import { PostCardSkeleton } from '@/components/skeletons/PostCardSkeleton';
import { ConversationsList } from '@/components/messaging/ConversationsList';
import { ConversationsSkeleton } from '@/components/skeletons/MessagesSkeleton';
import { ChartSkeleton } from '@/components/skeletons/ChartSkeleton';
import { ApexChartCard } from '@/components/charts/ApexChartCard';
import { LoadingRegion, LoadingError } from '@/components/loading/LoadingRegion';
import { Skeleton } from '@/components/ui/skeleton';
import { themes, getTheme } from '@/lib/themes';
import type { Book } from '@/types';
import type { Post, Conversation } from '@/services/api';
import '@/index.css';

type State = 'loading' | 'ready' | 'refreshing' | 'error' | 'empty';
declare global {
  interface Window {
    loadingFixture: {
      setState: (state: State) => void;
      setTheme: (id: string, dark: boolean) => void;
      themes: string[];
    };
    loadingMetrics: { cls: number; shifts: number; longTasks: number; maxLongTask: number };
  }
}

window.loadingMetrics = { cls: 0, shifts: 0, longTasks: 0, maxLongTask: 0 };
if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
  new PerformanceObserver((list) => list.getEntries().forEach((entry) => {
    const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
    if (!shift.hadRecentInput) { window.loadingMetrics.cls += shift.value; window.loadingMetrics.shifts += 1; }
  })).observe({ type: 'layout-shift', buffered: true });
}
if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
  new PerformanceObserver((list) => list.getEntries().forEach((entry) => {
    window.loadingMetrics.longTasks += 1;
    window.loadingMetrics.maxLongTask = Math.max(window.loadingMetrics.maxLongTask, entry.duration);
  })).observe({ type: 'longtask', buffered: true });
}

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

const params = new URLSearchParams(location.search);
setTheme(params.get('theme') ?? 'default', params.get('mode') === 'dark');
const surface = params.get('surface') ?? 'library';
const count = Math.min(8, Math.max(0, Number(params.get('count') ?? '2')));
const long = params.get('long') === '1';
const date = '2026-09-01T12:00:00Z';
const noop = () => {};
const book: Book = {
  id: 'book', user_id: 'reader', title: long ? 'A very long book title that should wrap within its own column without widening the library' : 'A room of one’s own',
  author: 'Virginia Woolf', isbn: null, genre: null, pages: 200, chapters: null,
  cover_url: null, description: null, status: 'to_read', tags: null, metadata: null,
  current_page: 0, date_started: null, date_finished: null, rating: null, notes: null,
  source_provider: null, source_id: null, shelf_position: null, created_at: date,
  updated_at: date, deleted_at: null,
};
const post: Post = {
  id: 'post', user_id: 'reader', title: 'A little more reading',
  content: long ? 'Reading is a conversation that carries on long after the last page. '.repeat(6) : 'Keeping a record of the books I return to.\nThere is always another chapter.',
  content_format: 'plain', post_type: 'text', visibility: 'public', likes_count: 3,
  comments_count: 0, share_count: 0, created_at: date, updated_at: date,
  user: { id: 'reader', display_name: 'Morgan' },
};
const conversations: Conversation[] = Array.from({ length: 5 }, (_, index) => ({
  id: `conversation-${index}`, participant_one_id: 'reader', participant_two_id: `friend-${index}`,
  created_at: date, updated_at: date,
  other_user: { id: `friend-${index}`, display_name: long ? 'A reader with a rather long display name' : `Reader ${index + 1}` },
  last_message: { id: `message-${index}`, content: 'What are you reading?', message_type: 'text', created_at: date, sender_id: `friend-${index}` },
}));

export function Fixture() {
  const [state, setState] = useState<State>('loading');
  useEffect(() => { window.loadingFixture = { setState, setTheme, themes: themes.map((theme) => theme.id) }; }, []);
  const loading = state === 'loading';
  const ready = state === 'ready' || state === 'refreshing';
  let content: React.ReactNode;
  if (surface === 'chart') {
    content = loading ? <ChartSkeleton /> : <ApexChartCard title="Reading Progress" subtitle="Last 14 days - 35 minutes tracked"><div data-plot="" className="w-full" style={{ height: 320 }}><svg role="img" aria-label="Reading progress chart" viewBox="0 0 400 320" className="h-full w-full"><path d="M10 290 L90 220 L170 240 L250 80 L330 150 L390 20" fill="none" stroke="currentColor" strokeWidth="2" /></svg></div></ApexChartCard>;
  } else if (surface === 'messages') {
    content = loading ? <ConversationsSkeleton /> : <ConversationsList conversations={conversations} selectedConversationId={null} onSelectConversation={noop} />;
  } else if (surface === 'post') {
    content = <div className="space-y-4">{Array.from({ length: count }, (_, i) => <div data-slot={i} key={i}>{loading ? <PostCardSkeleton /> : <PostCard post={{ ...post, id: `post-${i}` }} onLike={noop} />}</div>)}</div>;
  } else if (surface === 'gallery') {
    content = <><LibraryViewSkeleton viewMode="flat" /><LibraryViewSkeleton viewMode="bookshelf" /><LibraryViewSkeleton viewMode="carousel" /><ChartSkeleton /><ConversationsSkeleton /><PostCardSkeleton /></>;
  } else {
    content = <LibraryModeCase viewMode={surface === 'bookshelf' || surface === 'carousel' ? surface : 'flat'} loading={loading} count={count} book={book} />;
  }
  return <div className="flex min-h-screen">
    {params.get('sidebar') === '1' && <aside data-testid="sidebar" className="hidden w-64 shrink-0 border-r border-border bg-card p-4 md:block">Reader navigation</aside>}
    <main className="min-w-0 flex-1 bg-background text-foreground">
      <header className="border-b border-border p-4"><h1 className="font-display text-2xl">Loading layout contracts</h1></header>
      <div className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">
        <label className="block text-sm">Reading filter<input data-testid="filter" className="ml-2 max-w-full rounded border border-border bg-card p-2" defaultValue="Fiction" /></label>
        <div data-testid="content" data-state={state}>
          <LoadingRegion loading={loading} refreshing={state === 'refreshing'} label="Loading reading content">
            {loading || ready || surface === 'gallery' ? content : state === 'error' ? <LoadingError message="Reading content could not load." onRetry={() => setState('loading')} /> : <p>No books yet. Add your first book.</p>}
          </LoadingRegion>
        </div>
        <div data-testid="next-section" className="border-t border-border pt-4">The next section stays below this content.</div>
        <div className="h-[500px]" />
        <Skeleton className="hidden h-4 w-4" />
      </div>
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<MemoryRouter><TooltipProvider><Fixture /></TooltipProvider></MemoryRouter>);
