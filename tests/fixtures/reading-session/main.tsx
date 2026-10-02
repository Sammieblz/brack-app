/* eslint-disable react-refresh/only-export-components -- Standalone fixture with HMR disabled. */
import { StrictMode, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { ConfirmDialogProvider } from '@/contexts/ConfirmDialogContext';
import { AppNavigationProvider } from '@/contexts/AppNavigationProvider';
import { ShellUtilitiesProvider } from '@/components/ShellUtilities';
import { TimerProvider, useTimer } from '@/contexts/TimerContext';
import { JournalPromptHandler } from '@/components/JournalPromptHandler';
import { useAppViewportHeight } from '@/hooks/useAppViewportHeight';
import MyBooks from '@/screens/MyBooks';
import ProgressTracking from '@/screens/ProgressTracking';
import Dashboard from '@/screens/Dashboard';
import BookDetail from '@/screens/BookDetail';
import EditBook from '@/screens/EditBook';
import Achievements from '@/screens/Achievements';
import BookLists from '@/screens/BookLists';
import BookListDetail from '@/screens/BookListDetail';
import { useAuth, applyFixtureTheme } from '../library-tasks/data';
import { controls } from '../library-tasks/state';
import { snapshotRecords, sessionControls } from './api';
import { nativeControls } from './native';
import { nativeBridge } from '../back-ownership/adapters';
import './seed';
import '@/index.css';
applyFixtureTheme();
if (new URLSearchParams(location.search).get('text') === '200') document.documentElement.style.fontSize = '32px';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function FixtureRoutes() {
  useAppViewportHeight();
  const location = useLocation(); const navigate = useNavigate();
  const timer = useTimer();
  useLayoutEffect(() => {
    window.libraryTasks = { ...controls, records: snapshotRecords, navigate, back: nativeBridge.emitBack, native: nativeBridge.snapshot };
    window.readingSession = { ...sessionControls, device: nativeControls, timer: () => ({ time: timer.time, isRunning: timer.isRunning, isVisible: timer.isVisible, bookId: timer.bookId, clientSessionId: timer.clientSessionId, isSaving: timer.isSaving, isStarting: timer.isStarting, saveError: timer.saveError, storageWarning: timer.storageWarning, saveFrozen: timer.saveFrozen }) };
    document.documentElement.dataset.fixtureReady = 'true';
    return () => { delete window.libraryTasks; delete document.documentElement.dataset.fixtureReady; };
  }, [location, navigate, timer]);
  return <><Routes>
    <Route path="/achievements" element={<Achievements />} />
    <Route path="/book/:id/progress" element={<ProgressTracking />} /><Route path="/edit-book/:id" element={<EditBook />} /><Route path="/dashboard" element={<Dashboard />} /><Route path="/my-books" element={<MyBooks />} /><Route path="/books" element={<MyBooks />} /><Route path="/book/:id" element={<BookDetail />} />
    <Route path="/lists" element={<BookLists />} /><Route path="/book-lists" element={<BookLists />} /><Route path="/lists/:listId" element={<BookListDetail />} />
    <Route path="*" element={<main><h1>Outside the Library fixture</h1></main>} />
  </Routes><JournalPromptHandler /><Toaster /><Sonner /></>;
}
function AccountBoundary() {
  const { user } = useAuth();
  return <AppNavigationProvider accountScope={user?.id ?? null}><ConfirmDialogProvider><TimerProvider><ShellUtilitiesProvider><FixtureRoutes /></ShellUtilitiesProvider></TimerProvider></ConfirmDialogProvider></AppNavigationProvider>;
}
type ReadingFixtureAPI = typeof controls & { records: typeof snapshotRecords; navigate: (path: string) => void; back: typeof nativeBridge.emitBack; native: typeof nativeBridge.snapshot };
declare global { interface Window { libraryTasks?: ReadingFixtureAPI } }
declare global { interface Window { readingSession: typeof sessionControls & { device: typeof nativeControls; timer: () => { time: number; isRunning: boolean; isVisible: boolean; bookId: string | null; clientSessionId: string | null; isSaving: boolean; isStarting: boolean; saveError: string | null; storageWarning: string | null; saveFrozen: boolean } } } }
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><TooltipProvider><BrowserRouter><AccountBoundary /></BrowserRouter></TooltipProvider></QueryClientProvider></StrictMode>);
