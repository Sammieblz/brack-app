/* eslint-disable react-refresh/only-export-components -- Standalone fixture entry; its Vite server disables HMR. */
import { StrictMode, createContext, useContext, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppNavigationProvider } from '@/contexts/AppNavigationProvider';
import { AppNavigationContext } from '@/contexts/appNavigation';
import { AppBackButton } from '@/components/AppBackButton';
import { useAppBackGuard } from '@/hooks/useAppBackGuard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getTheme } from '@/lib/themes';
import { hasOpenOverlay } from '@/lib/backLayers';
import { nativeBridge } from './adapters';
import '@/index.css';

const bootParams = new URLSearchParams(window.location.search);
const query = bootParams.toString() ? `?${bootParams}` : '';
const theme = getTheme(bootParams.get('palette') ?? 'default');
const dark = bootParams.get('theme') === 'dark';
document.documentElement.classList.toggle('dark', dark);
if (bootParams.get('text') === '200') document.documentElement.style.fontSize = '32px';
for (const [key, value] of Object.entries(dark ? theme.colors.dark : theme.colors.light)) {
  document.documentElement.style.setProperty(`--${key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/chart(\d+)/g, 'chart-$1')}`, value);
}

type ReaderState = {
  draft: string; elapsed: number; pending: boolean; selection: boolean;
  overlayDraft: string; overlayPending: boolean; overlayCloses: number;
  guardChecks: number; selectionClears: number; callbacks: number;
};
const initialState: ReaderState = { draft: '', elapsed: 0, pending: false, selection: false,
  overlayDraft: '', overlayPending: false, overlayCloses: 0, guardChecks: 0, selectionClears: 0, callbacks: 0 };
type ReaderContextValue = {
  state: ReaderState; setState: Dispatch<SetStateAction<ReaderState>>;
  guardResponse: { current: ((allowed: boolean) => void) | null };
};
const ReaderContext = createContext<ReaderContextValue | null>(null);
const useReader = () => useContext(ReaderContext)!;
const href = (path: string) => `${path}${query}`;

function Task() {
  const { state, setState, guardResponse } = useReader();
  const [confirm, setConfirm] = useState(false);
  useAppBackGuard(Boolean(state.draft) || state.pending, () => {
    setState((current) => ({ ...current, guardChecks: current.guardChecks + 1 }));
    if (state.pending) return false;
    setConfirm(true);
    return new Promise<boolean>((resolve) => {
      guardResponse.current = (allowed) => {
        setConfirm(false);
        if (allowed) setState((current) => ({ ...current, draft: '' }));
        guardResponse.current = null;
        resolve(allowed);
      };
    });
  });
  return <>
    <h1 className="font-display text-2xl">Edit reading note</h1>
    <label htmlFor="draft" className="block font-medium">Reading draft</label>
    <textarea id="draft" className="min-h-32 w-full rounded border bg-background p-3" value={state.draft}
      onChange={(event) => setState((current) => ({ ...current, draft: event.target.value }))} />
    {state.pending && <p role="status" aria-label="Save status">Saving on this device…</p>}
    <Dialog open={confirm} onOpenChange={(open) => { if (!open) guardResponse.current?.(false); }}>
      <DialogContent><DialogTitle>Leave this draft?</DialogTitle><DialogDescription>Choose whether to keep editing.</DialogDescription>
        <Button onClick={() => guardResponse.current?.(false)}>Keep editing</Button>
        <Button variant="destructive" onClick={() => guardResponse.current?.(true)}>Discard and go back</Button>
      </DialogContent>
    </Dialog>
  </>;
}

function OverlayEditor() {
  const { state, setState } = useReader();
  const [open, setOpen] = useState(false);
  const [discard, setDiscard] = useState(false);
  const keepEditing = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { if (discard) keepEditing.current?.focus(); }, [discard]);
  const close = () => {
    setOpen(false); setDiscard(false);
    setState((current) => ({ ...current, overlayDraft: '', overlayCloses: current.overlayCloses + 1 }));
  };
  return <Dialog open={open} onOpenChange={(next) => {
    if (next) { setOpen(true); return; }
    if (state.overlayPending) return;
    if (state.overlayDraft) { setDiscard(true); return; }
    close();
  }}>
    <DialogTrigger asChild><Button>Open note editor</Button></DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto">
      <DialogTitle>Note editor</DialogTitle><DialogDescription>Synthetic writing with a real dismissal boundary.</DialogDescription>
      <AppBackButton label="Back from editor" showLabel />
      <label htmlFor="overlay-note">Book note</label>
      <textarea id="overlay-note" disabled={state.overlayPending || discard} className="min-h-24 border bg-background p-2"
        value={state.overlayDraft} onChange={(event) => setState((current) => ({ ...current, overlayDraft: event.target.value }))} />
      <div className="flex flex-wrap gap-2">
        <Popover><PopoverTrigger asChild><Button variant="outline">Date options</Button></PopoverTrigger>
          <PopoverContent><p>Nested date options</p><AppBackButton label="Back from date options" showLabel /></PopoverContent>
        </Popover>
        <Select defaultValue="note"><SelectTrigger aria-label="Note kind"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="note">Note</SelectItem><SelectItem value="quote">Quote</SelectItem></SelectContent>
        </Select>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline">More note actions</Button></DropdownMenuTrigger>
          <DropdownMenuContent><DropdownMenuItem>Copy note</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
      </div>
      {state.overlayPending && <p role="status" aria-label="Note save status">Saving note…</p>}
      {discard && <section aria-label="Discard note confirmation" className="space-y-3 rounded border p-3">
        <p>Discard this note?</p>
        <Button ref={keepEditing} onClick={() => setDiscard(false)}>Keep note</Button>
        <Button variant="destructive" onClick={close}>Discard note</Button>
      </section>}
    </DialogContent>
  </Dialog>;
}

function Library() {
  const { state, setState } = useReader();
  useAppBackGuard(state.selection, () => {
    setState((current) => ({ ...current, selection: false, selectionClears: current.selectionClears + 1 }));
    return false;
  }, 50);
  return <><h1 className="font-display text-2xl">My Library</h1>
    <Link className="block underline" to={href('/book/one')}>Open The Lantern</Link>
    <Button onClick={() => setState((current) => ({ ...current, selection: !current.selection }))}>{state.selection ? 'Finish selection' : 'Select books'}</Button>
    <p role="status" aria-label="Selection status">{state.selection ? 'One book selected' : 'No selection'}</p>
    <OverlayEditor />
  </>;
}

function Detail() {
  return <><h1 className="font-display text-2xl">The Lantern</h1>
    <p>A synthetic book for route ownership checks.</p>
    <Link className="block underline" to={href('/edit-book/one')}>Edit reading note</Link>
    <OverlayEditor />
  </>;
}

function Surface({ account, setAccount, remount }: { account: string; setAccount: (account: string) => void; remount: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = useContext(AppNavigationContext)!;
  const { state, setState, guardResponse } = useReader();
  const [backMode, setBackMode] = useState<'default' | 'callback' | 'to'>('default');
  const isRoot = ['/my-books', '/dashboard', '/lists'].includes(location.pathname);
  useLayoutEffect(() => {
    window.backOwnershipFixture = {
      snapshot: () => ({ ...state, account, backMode, route: `${location.pathname}${location.search}`, canGoBack: navigation.canGoBack,
        overlay: hasOpenOverlay(), native: nativeBridge.snapshot(), history: window.history.state }),
      appBack: () => navigation.requestBack(), nativeBack: nativeBridge.emitBack,
      setPending: (pending) => setState((current) => ({ ...current, pending })),
      setOverlayPending: (overlayPending) => setState((current) => ({ ...current, overlayPending })),
      advanceTimer: (seconds) => setState((current) => ({ ...current, elapsed: current.elapsed + seconds })),
      resolveGuard: (allowed) => guardResponse.current?.(allowed),
      changeAccount: () => setAccount(account === 'reader-a' ? 'reader-b' : 'reader-a'),
      remount, releaseNativeRegistration: nativeBridge.releaseRegistration,
      setBackMode,
      insertForeignGap: () => {
        const index = Number(window.history.state?.idx ?? 0);
        window.history.pushState({ idx: index + 1, key: `foreign-${index}` }, '', href('/book/foreign'));
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
      },
    };
  }, [account, state, location, navigation, setState, setAccount, remount, guardResponse, backMode]);
  return <main className="mx-auto min-h-screen max-w-3xl space-y-4 bg-background p-4 font-sans text-foreground sm:p-6" data-testid="fixture-ready">
    <p className="text-xs text-muted-foreground">BRACK Back ownership · synthetic data</p>
    <nav aria-label="Fixture destinations" className="flex flex-wrap gap-4">
      <Link className="underline" to={href('/my-books')}>Library</Link>
      <Link className="underline" to={href('/lists')}>Lists</Link>
    </nav>
    {!isRoot && <AppBackButton showLabel label="Back" {...(backMode === 'callback'
      ? { onBack: () => setState((current) => ({ ...current, callbacks: current.callbacks + 1 })) }
      : backMode === 'to' ? { to: href('/lists') } : {})} />}
    <Routes>
      <Route path="/my-books" element={<Library />} />
      <Route path="/dashboard" element={<h1 className="font-display text-2xl">Home</h1>} />
      <Route path="/book/:id" element={<Detail />} />
      <Route path="/edit-book/:id" element={<Task />} />
      <Route path="/lists" element={<h1 className="font-display text-2xl">Reading lists</h1>} />
    </Routes>
    <section aria-label="Session continuity" className="rounded border p-3">
      <p>Synthetic timer: <output aria-label="Elapsed seconds">{state.elapsed}</output> seconds</p>
      <p>Draft retained above routes: <output aria-label="Retained draft">{state.draft || 'Empty'}</output></p>
    </section>
    <Button variant="outline" onClick={() => navigate(`${location.pathname}?view=notes`, { replace: true })}>Replace tab query</Button>
    <output aria-label="Known app predecessor">{String(navigation.canGoBack)}</output>
  </main>;
}

function Fixture() {
  const [state, setState] = useState(initialState);
  const [account, setAccount] = useState('reader-a');
  const [generation, setGeneration] = useState(0);
  const guardResponse = useRef<((allowed: boolean) => void) | null>(null);
  return <ReaderContext.Provider value={{ state, setState, guardResponse }}>
    <BrowserRouter><AppNavigationProvider key={generation} accountScope={account}>
      <Surface account={account} setAccount={setAccount} remount={() => setGeneration((current) => current + 1)} />
    </AppNavigationProvider></BrowserRouter>
  </ReaderContext.Provider>;
}

export interface BackFixtureAPI {
  snapshot: () => ReaderState & { account: string; backMode: string; route: string; canGoBack: boolean; overlay: boolean;
    native: ReturnType<typeof nativeBridge.snapshot>; history: { idx?: number; key?: string } | null };
  appBack: () => void; nativeBack: () => void; setPending: (pending: boolean) => void; setOverlayPending: (pending: boolean) => void;
  advanceTimer: (seconds: number) => void; resolveGuard: (allowed: boolean) => void; changeAccount: () => void;
  remount: () => void; releaseNativeRegistration: () => void; setBackMode: (mode: 'default' | 'callback' | 'to') => void;
  insertForeignGap: () => void;
}
declare global { interface Window { backOwnershipFixture: BackFixtureAPI } }

createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);
