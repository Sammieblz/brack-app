/* eslint-disable react-refresh/only-export-components -- Fixture entry with HMR disabled. */
import { StrictMode, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ConfirmDialogProvider } from '@/contexts/ConfirmDialogContext';
import { AppNavigationProvider } from '@/contexts/AppNavigationProvider';
import { ShellUtilitiesProvider } from '@/components/ShellUtilities';
import { useAppViewportHeight } from '@/hooks/useAppViewportHeight';
import Feed from '@/screens/Feed';
import PostDetail from '@/screens/PostDetail';
import UserProfile from '@/screens/UserProfile';
import Messages from '@/screens/Messages';
import BookClubDetail from '@/screens/BookClubDetail';
import { applyFixtureTheme } from './data';
import { controls } from './state';
import { nativeBridge } from '../back-ownership/adapters';
import '@/index.css';

applyFixtureTheme();
if (new URLSearchParams(location.search).get('text') === '200') document.documentElement.style.fontSize = '32px';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function FixtureRoutes() {
  useAppViewportHeight();
  const location = useLocation();
  useLayoutEffect(() => {
    window.liveComposers = { ...controls, back: nativeBridge.emitBack, native: nativeBridge.snapshot };
    document.documentElement.dataset.fixtureReady = 'true';
    return () => { delete window.liveComposers; delete document.documentElement.dataset.fixtureReady; };
  }, [location]);
  return <><Routes>
    <Route path="/feed" element={<Feed />} />
    <Route path="/posts/:postId" element={<PostDetail />} />
    <Route path="/users/:userId" element={<UserProfile />} />
    <Route path="/messages" element={<Messages />} />
    <Route path="/clubs/:clubId" element={<BookClubDetail />} />
    <Route path="*" element={<p>Route outside this fixture</p>} />
  </Routes><Toaster /></>;
}
export type LiveComposersAPI = typeof controls & { back: typeof nativeBridge.emitBack; native: typeof nativeBridge.snapshot };
declare global { interface Window { liveComposers?: LiveComposersAPI } }
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><TooltipProvider>
  <BrowserRouter><AppNavigationProvider accountScope="shell-reader"><ConfirmDialogProvider><ShellUtilitiesProvider>
    <FixtureRoutes />
  </ShellUtilitiesProvider></ConfirmDialogProvider></AppNavigationProvider></BrowserRouter>
</TooltipProvider></QueryClientProvider></StrictMode>);
