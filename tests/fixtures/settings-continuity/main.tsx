/* eslint-disable react-refresh/only-export-components -- Standalone fixture with HMR disabled. */
import { StrictMode, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider as NextThemeProvider } from 'next-themes';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ProfileProvider } from '@/contexts/ProfileContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { ConfirmDialogProvider } from '@/contexts/ConfirmDialogContext';
import { AppNavigationProvider } from '@/contexts/AppNavigationProvider';
import { ShellUtilitiesProvider } from '@/components/ShellUtilities';
import { useAppViewportHeight } from '@/hooks/useAppViewportHeight';
import Settings from '@/screens/Settings';
import { useAuth } from './data';
import { controls } from './state';
import { nativeBridge } from '../back-ownership/adapters';
import '@/index.css';
if (new URLSearchParams(location.search).get('text') === '200') document.documentElement.style.fontSize = '32px';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function FixtureRoutes() {
  useAppViewportHeight();
  const location = useLocation();
  const navigate = useNavigate();
  useLayoutEffect(() => {
    window.settingsContinuity = { ...controls, navigate, back: nativeBridge.emitBack, native: nativeBridge.snapshot };
    document.documentElement.dataset.fixtureReady = 'true';
    return () => { delete window.settingsContinuity; delete document.documentElement.dataset.fixtureReady; };
  }, [location, navigate]);
  return <><Routes>
    <Route path="/settings" element={<Settings />} />
    <Route path="*" element={<main><h1>Outside the Settings fixture</h1></main>} />
  </Routes><Toaster /><Sonner /></>;
}
function AccountBoundary() {
  const { user } = useAuth();
  return <AppNavigationProvider accountScope={user?.id ?? null}><ConfirmDialogProvider><ThemeProvider><ProfileProvider><ShellUtilitiesProvider>
    <FixtureRoutes />
  </ShellUtilitiesProvider></ProfileProvider></ThemeProvider></ConfirmDialogProvider></AppNavigationProvider>;
}
export type SettingsContinuityAPI = typeof controls & { navigate: (path: string) => void; back: typeof nativeBridge.emitBack; native: typeof nativeBridge.snapshot };
declare global { interface Window { settingsContinuity?: SettingsContinuityAPI } }
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><TooltipProvider>
  <NextThemeProvider attribute="class" defaultTheme="light" enableSystem={false}><BrowserRouter><AccountBoundary /></BrowserRouter></NextThemeProvider>
</TooltipProvider></QueryClientProvider></StrictMode>);
