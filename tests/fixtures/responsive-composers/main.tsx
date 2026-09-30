/* eslint-disable react-refresh/only-export-components -- Fixture entry with HMR disabled. */
import { StrictMode, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ConfirmDialogProvider } from '@/contexts/ConfirmDialogContext';
import { AppNavigationProvider } from '@/contexts/AppNavigationProvider';
import { ShellUtilitiesProvider } from '@/components/ShellUtilities';
import { useAppViewportHeight } from '@/hooks/useAppViewportHeight';
import Feed from '@/screens/Feed';
import BookClubs from '@/screens/BookClubs';
import Readers from '@/screens/Readers';
import { applyFixtureTheme, useAuth } from './data';
import { controls } from './state';
import { nativeBridge } from '../back-ownership/adapters';
import '@/index.css';

applyFixtureTheme();
if (new URLSearchParams(location.search).get('text') === '200') document.documentElement.style.fontSize = '32px';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function FixtureRoutes() {
  useAppViewportHeight();
  const location = useLocation();
  const navigate = useNavigate();
  useLayoutEffect(() => {
    window.responsiveComposers = { ...controls, navigate, back: nativeBridge.emitBack, native: nativeBridge.snapshot };
    document.documentElement.dataset.fixtureReady = 'true';
    return () => { delete window.responsiveComposers; delete document.documentElement.dataset.fixtureReady; };
  }, [location, navigate]);
  return <><Routes>
    <Route path="/feed" element={<Feed />} />
    <Route path="/clubs" element={<BookClubs />} />
    <Route path="/readers" element={<Readers />} />
    <Route path="/fixture-destination" element={<main><h1>Task left</h1></main>} />
    <Route path="*" element={<p>Route outside this fixture</p>} />
  </Routes><Toaster /></>;
}
function AccountBoundary() {
  const { user } = useAuth();
  return <AppNavigationProvider accountScope={user?.id ?? null}><ConfirmDialogProvider><ShellUtilitiesProvider>
    <FixtureRoutes />
  </ShellUtilitiesProvider></ConfirmDialogProvider></AppNavigationProvider>;
}
export type ResponsiveComposersAPI = typeof controls & { navigate: (path: string) => void; back: typeof nativeBridge.emitBack; native: typeof nativeBridge.snapshot };
declare global { interface Window { responsiveComposers?: ResponsiveComposersAPI } }
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><TooltipProvider>
  <BrowserRouter><AccountBoundary /></BrowserRouter>
</TooltipProvider></QueryClientProvider></StrictMode>);
