/* eslint-disable react-refresh/only-export-components -- Fixture entry with HMR disabled. */
import { StrictMode, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfirmDialogProvider } from '@/contexts/ConfirmDialogContext';
import { AppNavigationProvider } from '@/contexts/AppNavigationProvider';
import { MobileLayout } from '@/components/MobileLayout';
import { MobileHeader } from '@/components/MobileHeader';
import { NativeHeader } from '@/components/NativeHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAppViewportHeight } from '@/hooks/useAppViewportHeight';
import { useUIEnvironment } from '@/hooks/useUIEnvironment';
import MyBooks from '@/screens/MyBooks';
import AddBook from '@/screens/AddBook';
import EditBook from '@/screens/EditBook';
import { JournalPromptHandler } from '@/components/JournalPromptHandler';
import { ShellUtilitiesProvider } from '@/components/ShellUtilities';
import { applyFixtureTheme, fixtureData } from './data';
import { nativeBridge } from './adapters';
import '@/index.css';

applyFixtureTheme();
if (new URLSearchParams(location.search).get('text') === '200') document.documentElement.style.fontSize = '32px';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
let taskMounts = 0;
function TaskScreen() {
  const [instance] = useState(() => ++taskMounts);
  const [draft, setDraft] = useState('');
  const isMobile = useIsMobile();
  return <MobileLayout>
    {isMobile ? <MobileHeader title="Reading note" showBack /> : <NativeHeader title="Reading note" back={{}} />}
    <section className="mx-auto max-w-2xl space-y-4 p-5">
      <p>Keep this thought while changing window size.</p>
      <label className="block" htmlFor="reading-draft">Reading draft</label>
      <textarea id="reading-draft" className="min-h-32 w-full rounded border bg-background p-3" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <output aria-label="Task instance">{instance}</output>
      {Array.from({ length: 12 }, (_, index) => <p className="min-h-24" key={index}>Reading observation {index + 1}</p>)}
      <button type="button" className="min-h-11 rounded border p-3">Save final observation</button>
    </section>
  </MobileLayout>;
}
function DestinationScreen() {
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  return <MobileLayout>
    {isMobile ? <MobileHeader title="Destination reached" /> : <NativeHeader title="Destination reached" />}
    <div className="p-5"><p data-testid="destination-path">{pathname}</p><Link to="/my-books">Return to Library</Link></div>
  </MobileLayout>;
}
function FixtureRoutes() {
  useAppViewportHeight();
  const environment = useUIEnvironment();
  const location = useLocation();
  useLayoutEffect(() => {
    window.adaptiveShellFixture = { snapshot: () => ({ environment, pathname: location.pathname, ...fixtureData.snapshot(), native: nativeBridge.snapshot() }),
      back: nativeBridge.emitBack, setTimer: fixtureData.setTimer };
    document.documentElement.dataset.fixtureReady = 'true';
    return () => { delete window.adaptiveShellFixture; delete document.documentElement.dataset.fixtureReady; };
  }, [environment, location]);
  return <><Routes><Route path="/my-books" element={<MyBooks />} /><Route path="/note" element={<TaskScreen />} />
    <Route path="/add-book" element={<AddBook />} /><Route path="/edit-book/:id" element={<EditBook />} />
    <Route path="*" element={<DestinationScreen />} /></Routes><JournalPromptHandler /></>;
}
export type AdaptiveShellFixtureAPI = { snapshot: () => { environment: ReturnType<typeof useUIEnvironment>; pathname: string;
  timer: ReturnType<typeof fixtureData.snapshot>['timer']; finished: number; cancelled: number; native: ReturnType<typeof nativeBridge.snapshot> };
  back: typeof nativeBridge.emitBack; setTimer: typeof fixtureData.setTimer };
declare global { interface Window { adaptiveShellFixture?: AdaptiveShellFixtureAPI } }
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><TooltipProvider>
  <BrowserRouter><AppNavigationProvider accountScope="shell-reader"><ConfirmDialogProvider><ShellUtilitiesProvider><FixtureRoutes /></ShellUtilitiesProvider></ConfirmDialogProvider></AppNavigationProvider></BrowserRouter>
</TooltipProvider></QueryClientProvider></StrictMode>);
