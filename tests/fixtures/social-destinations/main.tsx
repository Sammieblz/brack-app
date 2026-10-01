/* eslint-disable react-refresh/only-export-components -- Isolated fixture entry; HMR disabled. */
import { StrictMode, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ConfirmDialogProvider } from '@/contexts/ConfirmDialogContext';
import { AppNavigationProvider } from '@/contexts/AppNavigationProvider';
import { ShellUtilitiesProvider } from '@/components/ShellUtilities';
import { FeatureGate } from '@/components/FeatureGate';
import { useAppViewportHeight } from '@/hooks/useAppViewportHeight';
import Readers from '@/screens/Readers';
import Feed from '@/screens/Feed';
import PostDetail from '@/screens/PostDetail';
import UserProfile from '@/screens/UserProfile';
import BookClubs from '@/screens/BookClubs';
import BookClubDetail from '@/screens/BookClubDetail';
import Reviews from '@/screens/Reviews';
import ReviewDetail from '@/screens/ReviewDetail';
import BookDetail from '@/screens/BookDetail';
import { applyFixtureTheme, actions } from './data';
import '@/index.css';
applyFixtureTheme();
if (new URLSearchParams(location.search).get('text') === '200') document.documentElement.style.fontSize = '32px';
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Fixture() {
  useAppViewportHeight();
  const location = useLocation();
  useLayoutEffect(() => { document.documentElement.dataset.fixtureReady = 'true'; window.destinationActions = actions; }, [location]);
  return <><Routes>
    <Route path="/readers" element={<FeatureGate feature="social"><Readers /></FeatureGate>} /><Route path="/feed" element={<FeatureGate feature="social"><Feed /></FeatureGate>} />
    <Route path="/posts/:postId" element={<FeatureGate feature="social"><PostDetail /></FeatureGate>} /><Route path="/users/:userId" element={<FeatureGate feature="social"><UserProfile /></FeatureGate>} />
    <Route path="/clubs" element={<FeatureGate feature="social"><BookClubs /></FeatureGate>} /><Route path="/clubs/:clubId" element={<FeatureGate feature="social"><BookClubDetail /></FeatureGate>} />
    <Route path="/reviews" element={<FeatureGate feature="social"><Reviews /></FeatureGate>} /><Route path="/reviews/:reviewId" element={<FeatureGate feature="social"><ReviewDetail /></FeatureGate>} />
    <Route path="/book/:id" element={<BookDetail />} />
    <Route path="*" element={<p>Outside destination fixture: {location.pathname}{location.search}</p>} />
  </Routes><Toaster /></>;
}
declare global { interface Window { destinationActions: string[] } }
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={client}><TooltipProvider>
  <BrowserRouter><AppNavigationProvider accountScope="shell-reader"><ConfirmDialogProvider><ShellUtilitiesProvider>
    <Fixture />
  </ShellUtilitiesProvider></ConfirmDialogProvider></AppNavigationProvider></BrowserRouter>
</TooltipProvider></QueryClientProvider></StrictMode>);
