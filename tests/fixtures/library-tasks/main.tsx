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
import { useAppViewportHeight } from '@/hooks/useAppViewportHeight';
import MyBooks from '@/screens/MyBooks';
import BookDetail from '@/screens/BookDetail';
import BookLists from '@/screens/BookLists';
import BookListDetail from '@/screens/BookListDetail';
import { useAuth, applyFixtureTheme } from './data';
import { controls } from './state';
import { snapshotRecords } from './api';
import { nativeBridge } from '../back-ownership/adapters';
import '@/index.css';
applyFixtureTheme();
if (new URLSearchParams(location.search).get('text') === '200') document.documentElement.style.fontSize = '32px';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function FixtureRoutes() {
  useAppViewportHeight();
  const location = useLocation(); const navigate = useNavigate();
  useLayoutEffect(() => {
    window.libraryTasks = { ...controls, records: snapshotRecords, navigate, back: nativeBridge.emitBack, native: nativeBridge.snapshot };
    document.documentElement.dataset.fixtureReady = 'true';
    return () => { delete window.libraryTasks; delete document.documentElement.dataset.fixtureReady; };
  }, [location, navigate]);
  return <><Routes>
    <Route path="/my-books" element={<MyBooks />} /><Route path="/books" element={<MyBooks />} /><Route path="/book/:id" element={<BookDetail />} />
    <Route path="/lists" element={<BookLists />} /><Route path="/book-lists" element={<BookLists />} /><Route path="/lists/:listId" element={<BookListDetail />} />
    <Route path="*" element={<main><h1>Outside the Library fixture</h1></main>} />
  </Routes><Toaster /><Sonner /></>;
}
function AccountBoundary() {
  const { user } = useAuth();
  return <AppNavigationProvider accountScope={user?.id ?? null}><ConfirmDialogProvider><ShellUtilitiesProvider><FixtureRoutes /></ShellUtilitiesProvider></ConfirmDialogProvider></AppNavigationProvider>;
}
export type LibraryTasksAPI = typeof controls & { records: typeof snapshotRecords; navigate: (path: string) => void; back: typeof nativeBridge.emitBack; native: typeof nativeBridge.snapshot };
declare global { interface Window { libraryTasks?: LibraryTasksAPI } }
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><TooltipProvider><BrowserRouter><AccountBoundary /></BrowserRouter></TooltipProvider></QueryClientProvider></StrictMode>);
