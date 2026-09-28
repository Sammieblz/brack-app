import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster as SonnerToaster } from 'sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import AddBook from '@/screens/AddBook';
import { ContextMenuNative } from '@/components/ui/context-menu-native';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { hapticsEnabled } from './state';
import '@/index.css';
import { AppNavigationProvider } from '@/contexts/AppNavigationProvider';
import { ConfirmDialogProvider } from '@/contexts/ConfirmDialogContext';

export function Destination() {
  const location = useLocation();
  return <section className="p-6"><h1>Fixture destination</h1><p data-testid="destination">{location.pathname}:{location.state?.highlightBookId ?? ''}</p></section>;
}
export function Gestures() {
  const [clicks, setClicks] = useState(0);
  const [actions, setActions] = useState(0);
  const [shown, setShown] = useState(true);
  const { triggerHaptic } = useHapticFeedback({ enabled: hapticsEnabled });
  return <section className="p-6">
    <button className="min-h-11 border px-4" onClick={() => void triggerHaptic('selection')}>Selection feedback</button>
    <button className="min-h-11 border px-4" onClick={() => setShown((previous) => !previous)}>Toggle target</button>
    <p data-testid="clicks">{clicks}</p><p data-testid="actions">{actions}</p>
    {shown && <ContextMenuNative title="Fixture book" hapticsEnabled={hapticsEnabled} actions={[{ label: 'Read fixture book', onClick: () => setActions((previous) => previous + 1) }]}>
      <div data-testid="press-target" className="min-h-32 border p-6" onClick={() => setClicks((previous) => previous + 1)}>A fixture book card</div>
      <a href="#native-link" data-testid="native-link">Native link</a>
      <label htmlFor="native-field">Native field</label><input id="native-field" className="border" />
    </ContextMenuNative>}
    <div className="h-[1200px]" aria-hidden="true" />
  </section>;
}
export function Fixture() {
  return <TooltipProvider><ConfirmDialogProvider><BrowserRouter><AppNavigationProvider accountScope="fixture-reader"><header className="flex flex-wrap gap-4 border-b p-4"><p>Action feedback fixture</p>
    <Link to="/add-book">Add fixture</Link><Link to="/gestures">Gesture fixture</Link><Link to="/elsewhere">Leave fixture</Link>
  </header><Routes>
    <Route path="/add-book" element={<AddBook />} /><Route path="/gestures" element={<Gestures />} /><Route path="*" element={<Destination />} />
  </Routes><SonnerToaster /><Toaster /></AppNavigationProvider></BrowserRouter></ConfirmDialogProvider></TooltipProvider>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
