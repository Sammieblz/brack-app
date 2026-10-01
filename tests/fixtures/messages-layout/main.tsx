/* eslint-disable react-refresh/only-export-components -- Fixture entry with HMR disabled. */
import { StrictMode, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ConfirmDialogProvider } from '@/contexts/ConfirmDialogContext';
import { AppNavigationProvider } from '@/contexts/AppNavigationProvider';
import { ShellUtilitiesProvider } from '@/components/ShellUtilities';
import { useAppViewportHeight } from '@/hooks/useAppViewportHeight';
import Messages from '@/screens/Messages';
import { applyFixtureTheme } from './data';
import { controls } from './state';
import { nativeBridge } from '../back-ownership/adapters';
import '@/index.css';

applyFixtureTheme();
const entry = new URLSearchParams(location.search).get('entry');
if (entry) history.replaceState({ usr: entry === 'reader' ? { startConversationWith: 'reader-taylor' } : { conversationId: 'conversation-one' }, key: 'fixture-entry', idx: 0 }, '', location.href);
if (new URLSearchParams(location.search).get('text') === '200') document.documentElement.style.fontSize = '32px';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function FixtureRoutes() {
  useAppViewportHeight();
  useLayoutEffect(() => {
    window.messagesLayout = { ...controls, back: nativeBridge.emitBack, native: nativeBridge.snapshot };
    document.documentElement.dataset.fixtureReady = 'true';
    return () => { delete window.messagesLayout; delete document.documentElement.dataset.fixtureReady; };
  }, []);
  return <><Routes><Route path="/messages" element={<Messages />} />
    <Route path="*" element={<p>Route outside this fixture</p>} /></Routes><Toaster /></>;
}
export type MessagesLayoutAPI = typeof controls & { back: typeof nativeBridge.emitBack; native: typeof nativeBridge.snapshot };
declare global { interface Window { messagesLayout?: MessagesLayoutAPI } }
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><TooltipProvider>
  <BrowserRouter><AppNavigationProvider accountScope="shell-reader"><ConfirmDialogProvider><ShellUtilitiesProvider>
    <FixtureRoutes />
  </ShellUtilitiesProvider></ConfirmDialogProvider></AppNavigationProvider></BrowserRouter>
</TooltipProvider></QueryClientProvider></StrictMode>);
