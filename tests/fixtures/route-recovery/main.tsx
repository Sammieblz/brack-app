/* eslint-disable react-refresh/only-export-components -- Standalone fixture, HMR disabled. */
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
import BookLists from '@/screens/BookLists';
import GoalsManagement from '@/screens/GoalsManagement';
import BookClubDetail from '@/screens/BookClubDetail';
import BookClubs from '@/screens/BookClubs';
import Auth from '@/screens/Auth';
import { OnboardingRouteGuard } from '@/components/OnboardingRouteGuard';
import { useAuth, applyFixtureTheme, controls } from './data';
import { setClubMode } from './api';
import '@/index.css';
applyFixtureTheme();
if (new URLSearchParams(location.search).get('text') === '200') document.documentElement.style.fontSize = '32px';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function FixtureRoutes() {
  useAppViewportHeight();
  const location = useLocation(); const navigate = useNavigate();
  useLayoutEffect(() => {
    window.routeRecovery = { ...controls, setClubMode, navigate };
    document.documentElement.dataset.fixtureReady = 'true';
    return () => { delete window.routeRecovery; delete document.documentElement.dataset.fixtureReady; };
  }, [location, navigate]);
  return <><OnboardingRouteGuard /><Routes>
    <Route path="/my-books" element={<MyBooks />} />
    <Route path="/lists" element={<BookLists />} /><Route path="/book-lists" element={<BookLists />} />
    <Route path="/goals-management" element={<GoalsManagement />} />
    <Route path="/clubs" element={<BookClubs />} /><Route path="/clubs/:clubId" element={<BookClubDetail />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="*" element={<main><h1>Outside the recovery fixture</h1></main>} />
  </Routes><Toaster /><Sonner /></>;
}
function AccountBoundary() {
  const { user, loading } = useAuth();
  return <AppNavigationProvider accountScope={loading ? undefined : user?.id ?? null}><ConfirmDialogProvider><ShellUtilitiesProvider><FixtureRoutes /></ShellUtilitiesProvider></ConfirmDialogProvider></AppNavigationProvider>;
}
declare global { interface Window { routeRecovery?: typeof controls & { setClubMode: typeof setClubMode; navigate: (path: string) => void } } }
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><TooltipProvider><BrowserRouter><AccountBoundary /></BrowserRouter></TooltipProvider></QueryClientProvider></StrictMode>);
