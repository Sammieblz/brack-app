import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfirmDialogProvider } from '@/contexts/ConfirmDialogContext';
import { PageTransition } from '@/components/animations/PageTransition';
import { useAppViewportHeight } from '@/hooks/useAppViewportHeight';
import MyBooks from '@/screens/MyBooks';
import Achievements from '@/screens/Achievements';
import '@/index.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
export function FixtureRoutes() {
  useAppViewportHeight();
  return <div className="relative min-h-full w-full overflow-x-hidden"><div className="relative min-h-full w-full bg-background"><PageTransition><Routes>
    <Route path="/my-books" element={<MyBooks />} /><Route path="/achievements" element={<Achievements />} />
  </Routes></PageTransition></div></div>;
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode><QueryClientProvider client={queryClient}><TooltipProvider><BrowserRouter><ConfirmDialogProvider>
    <FixtureRoutes />
  </ConfirmDialogProvider></BrowserRouter></TooltipProvider></QueryClientProvider></React.StrictMode>,
);
