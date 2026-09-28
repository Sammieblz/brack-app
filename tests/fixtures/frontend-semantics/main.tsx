import { useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { UserNotificationsPopover } from '@/components/UserNotificationsPopover';
import { FeatureGate } from '@/components/FeatureGate';
import ReadingHistory from '@/screens/ReadingHistory';
import UserProfile from '@/screens/UserProfile';
import NotFound from '@/screens/NotFound';
import { ReviewForm } from '@/components/social/ReviewForm';
import { getHeaderVersion, queryClient, subscribe } from './state';
import '@/index.css';

export function Destination() {
  const location = useLocation();
  const navigate = useNavigate();
  return <section className="p-6"><h1>Fixture destination</h1><p data-testid="destination">{location.pathname}{location.search}</p>
    <button onClick={() => navigate(-1)} className="min-h-11 border px-4">Return to source</button></section>;
}
export function Editors() {
  const [open, setOpen] = useState(false);
  return <section className="p-6"><button className="min-h-11 border px-4" onClick={(event) => { event.currentTarget.focus(); setOpen(true); }}>Write fixture review</button>
    <ReviewForm open={open} onOpenChange={setOpen} bookId="fixture-book" /></section>;
}
export function Fixture() {
  const headerVersion = useSyncExternalStore(subscribe, getHeaderVersion, getHeaderVersion);
  return <div className="min-h-screen bg-background text-foreground">
    <header className="flex flex-wrap items-center gap-4 border-b p-4">
      <p className="font-display">Frontend semantics fixture</p>
      <nav aria-label="Fixture routes" className="flex flex-wrap gap-4">
        <Link to="/history">History fixture</Link><Link to="/users/fixture-profile">Profile fixture</Link>
        <Link to="/editors">Editor fixture</Link><Link to="/missing">Missing page fixture</Link>
      </nav><UserNotificationsPopover key={headerVersion} />
    </header>
    <Routes>
      <Route path="/history" element={<ReadingHistory />} />
      <Route path="/users/:userId" element={<FeatureGate feature="social"><UserProfile /></FeatureGate>} />
      <Route path="/clubs/:clubId" element={<FeatureGate feature="social"><Destination /></FeatureGate>} />
      <Route path="/achievements" element={<FeatureGate feature="gamification"><Destination /></FeatureGate>} />
      <Route path="/book/:id" element={<Destination />} />
      <Route path="/dashboard" element={<Destination />} />
      <Route path="/analytics" element={<Destination />} />
      <Route path="/my-books" element={<Destination />} />
      <Route path="/" element={<Destination />} />
      <Route path="/editors" element={<Editors />} />
      <Route path="*" element={<NotFound />} />
    </Routes><Toaster />
  </div>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={queryClient}><TooltipProvider><BrowserRouter><Fixture /></BrowserRouter></TooltipProvider></QueryClientProvider>);
