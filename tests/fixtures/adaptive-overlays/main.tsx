import { StrictMode, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MobileAlertDialog, MobileDialog } from '@/components/ui/mobile-dialog';
import { ActionSheet } from '@/components/ui/action-sheet';
import { GoalsSheet } from '@/components/GoalsSheet';
import { Button } from '@/components/ui/button';
import { useUIEnvironment } from '@/hooks/useUIEnvironment';
import { useAppViewportHeight } from '@/hooks/useAppViewportHeight';
import { getTheme } from '@/lib/themes';
import '@/index.css';

const params = new URLSearchParams(window.location.search);
const longContent = params.has('long');
const dark = params.get('theme') === 'dark';
const theme = getTheme(params.get('palette') ?? 'default');
document.documentElement.classList.toggle('dark', dark);
if (params.get('text') === '200') document.documentElement.style.fontSize = '32px';
for (const [key, value] of Object.entries(dark ? theme.colors.dark : theme.colors.light)) {
  document.documentElement.style.setProperty(`--${key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/chart(\d+)/g, 'chart-$1')}`, value);
}

type FixtureSnapshot = {
  closeRequests: number; completedCloses: number; confirmed: number; saved: string;
  selectedAction: string; runtime: string; windowClass: string; visualScale: number;
};
export interface AdaptiveOverlayFixtureAPI { snapshot: () => FixtureSnapshot }
declare global { interface Window { adaptiveOverlayFixture?: AdaptiveOverlayFixtureAPI } }

export function Fixture() {
  const environment = useUIEnvironment();
  const draftRef = useRef<HTMLInputElement>(null);
  const confirmationInvoker = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [closeRequests, setCloseRequests] = useState(0);
  const [completedCloses, setCompletedCloses] = useState(0);
  const [confirmed, setConfirmed] = useState(0);
  const [saved, setSaved] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  useAppViewportHeight();
  useLayoutEffect(() => {
    window.adaptiveOverlayFixture = { snapshot: () => ({ closeRequests, completedCloses, confirmed, saved, selectedAction,
      runtime: environment.runtime, windowClass: environment.windowClass, visualScale: environment.visualScale }) };
    setReady(true);
  }, [closeRequests, completedCloses, confirmed, saved, selectedAction, environment]);
  useLayoutEffect(() => () => { delete window.adaptiveOverlayFixture; }, []);

  const close = () => { setConfirm(false); setOpen(false); setCompletedCloses((count) => count + 1); };
  const changeOpen = (next: boolean) => {
    if (next) { setOpen(true); return; }
    setCloseRequests((count) => count + 1);
    if (pending) return;
    if (draftRef.current?.value) {
      confirmationInvoker.current = document.activeElement as HTMLElement | null;
      setConfirm(true); return;
    }
    close();
  };
  const actions = [
    { label: 'Move to currently reading', onClick: () => setSelectedAction('reading') },
    ...(longContent ? Array.from({ length: 12 }, (_, index) => ({
      label: `Reading option ${index + 1}: organize this book with a descriptive label that wraps onto several lines`,
      onClick: () => setSelectedAction(`option-${index + 1}`),
    })) : []),
    { label: 'Remove from this reading list permanently', variant: 'destructive' as const, onClick: () => setSelectedAction('remove') },
  ];

  return <main className="mx-auto min-h-screen max-w-4xl space-y-5 p-6 font-sans">
    <h1 className="font-display text-2xl">Adaptive reading tasks</h1>
    <p>Local synthetic content with production BRACK overlays.</p>
    <p data-testid="fixture-ready">{ready ? 'Ready' : 'Starting'}</p>
    <div className="flex flex-wrap gap-3">
      <MobileDialog open={open} onOpenChange={changeOpen}
        trigger={<Button>Open reading note</Button>} title="Reading note"
        description="Keep a thought from your current book. Your draft stays here until you save or discard it."
        footer={<Button onClick={() => { setSaved(draftRef.current?.value ?? ''); close(); }}>Save note</Button>}>
        <div className="space-y-4">
          <label className="block space-y-2"><span className="block">Note draft</span>
            <input ref={draftRef} defaultValue="" className="min-h-11 w-full min-w-0 rounded border bg-background px-3 py-2" />
          </label>
          <label className="flex items-start gap-2"><input type="checkbox" checked={pending}
            onChange={(event) => setPending(event.target.checked)} /><span>Simulate pending save</span></label>
          {pending && <p role="status">Saving note on this device</p>}
          <Button variant="outline" onClick={(event) => {
            confirmationInvoker.current = event.currentTarget;
            setConfirm(true);
          }}>Review discard</Button>
          {longContent && Array.from({ length: 20 }, (_, index) => <p key={index}>
            Passage {index + 1}. A reader should be able to review a longer note with larger text, reach every action, and keep their place while the window changes.
          </p>)}
          {longContent && <label className="block space-y-2"><span className="block">Last passage note</span>
            <input defaultValue="" className="min-h-11 w-full min-w-0 rounded border bg-background px-3 py-2" />
          </label>}
        </div>
        <MobileAlertDialog open={confirm} onOpenChange={setConfirm} title="Discard this note?"
          returnFocusRef={confirmationInvoker}
          description="Discarding removes the current unsaved thought. You can keep editing instead."
          cancelText="Keep editing" confirmText="Discard note" variant="destructive"
          onConfirm={() => { setConfirmed((count) => count + 1); close(); }} />
      </MobileDialog>
      <ActionSheet title="Book actions" description="Choose what happens to this book." actions={actions}
        trigger={<Button variant="outline">Open book actions</Button>} />
      <GoalsSheet />
    </div>
    <output aria-label="Saved note">{saved}</output>
    <output aria-label="Selected book action">{selectedAction}</output>
    <div aria-hidden="true" className="h-[80vh]" />
    <p>Background page content remains outside the active modal task.</p>
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);
