import { useEffect, useRef, useState, type ForwardRefExoticComponent, type RefAttributes } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { Book, EditPencil } from 'iconoir-react';
import { getDateInputFormat } from '@/lib/dateOnly';
import { ReadingForm, type ReadingDraft, type SavedReadingDraft } from './reading-form';
import type { SurfaceHandle, SurfaceProps } from './surface';

interface Snapshot { open: boolean; pending: boolean; saves: SavedReadingDraft[]; draft: ReadingDraft; presents: number; dismisses: string[]; }
declare global { interface Window { ionicFitFixture: {
  snapshot: () => Snapshot; resolveSave: () => void; rejectSave: () => void; dismiss: (role: string) => Promise<boolean>;
}; } }

type SurfaceComponent = ForwardRefExoticComponent<SurfaceProps & RefAttributes<SurfaceHandle>>;
function Experience({ Surface, kind }: { Surface: SurfaceComponent; kind: string }) {
  const initial = useRef<ReadingDraft>({ title: 'A quieter reading habit',
    dateText: getDateInputFormat(new URLSearchParams(location.search).get('locale') ?? 'en-US').format('1999-02-05'), notes: '' });
  const [draft, setDraft] = useState(initial.current);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discardRequested, setDiscardRequested] = useState(false);
  const [saved, setSaved] = useState<SavedReadingDraft[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const pending = useRef<{ value: SavedReadingDraft; resolve: () => void; reject: () => void } | null>(null);
  const surface = useRef<SurfaceHandle>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const telemetry = useRef({ presents: 0, dismisses: [] as string[] });
  const route = useLocation();
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial.current);
  const canDismiss = (role: string) => {
    if (pending.current) return false;
    if (role === 'saved' || role === 'discard') return true;
    if (dirty) { setDiscardRequested(true); return false; }
    return true;
  };
  const dismiss = (role: string) => surface.current?.dismiss(role) ?? Promise.resolve(false);
  const save = async (value: SavedReadingDraft) => {
    if (pending.current) return;
    setSaving(true); setError(null);
    try {
      await new Promise<void>((resolve, reject) => { pending.current = { value, resolve, reject: () => reject(new Error('Could not save this fixture note. Try again.')) }; });
      pending.current = null;
      setSaved((current) => [...current, value]);
      setAnnouncement('Note saved in this local demonstration.');
      await dismiss('saved');
    } catch (failure) { pending.current = null; setError((failure as Error).message); }
    finally { setSaving(false); }
  };
  useEffect(() => {
    window.ionicFitFixture = {
      snapshot: () => ({ open, pending: !!pending.current, saves: saved, draft, ...telemetry.current }),
      resolveSave: () => pending.current?.resolve(), rejectSave: () => pending.current?.reject(), dismiss,
    };
  });
  return <>
    <div id="ion-view-container-root" data-testid="experience-background">
      <header className="fit-header"><Book aria-hidden="true" /><span>BRACK</span><span className="fit-caption">Ionic fit experiment</span></header>
      <main className="fit-page" data-testid="page-scroll">
        <p className="fit-eyebrow">A local reading space</p>
        <Routes>
          <Route path="*" element={<><h1>Your next chapter</h1><p>A shared reading form, compared with {kind}.</p></>} />
          <Route path="/book/fixture" element={<><h1>The quiet library</h1><p>This addressable detail uses the existing React Router.</p></>} />
        </Routes>
        <nav aria-label="Fixture destinations"><Link to="/">Library</Link><Link to="/book/fixture">Book detail</Link></nav>
        <article className="fit-book"><div className="fit-cover"><Book aria-hidden="true" /></div><div><h2>The quiet library</h2><p className="font-serif">A little room for the things you notice while reading.</p>
          <button ref={opener} className="fit-button fit-primary" onClick={() => { setDiscardRequested(false); setError(null); setOpen(true); }}><EditPencil aria-hidden="true" />Add reading note</button>
        </div></article>
        <p role="status" data-testid="save-announcement">{announcement}</p>
        <output data-testid="route">{route.pathname}</output>
        <div className="fit-long-content" aria-label="Reading context">{Array.from({ length: 12 }, (_, i) => <p key={i}>Chapter {i + 1}. Keep the words you want to return to, at your own pace.</p>)}</div>
      </main>
    </div>
    <Surface ref={surface} open={open} canDismiss={canDismiss}
      onPresented={() => { telemetry.current.presents++; document.getElementById('reading-title')?.focus({ preventScroll: true }); }}
      onDismissed={(role) => { telemetry.current.dismisses.push(role); setOpen(false); setDiscardRequested(false);
        if (role === 'saved' || role === 'discard') setDraft(initial.current);
        requestAnimationFrame(() => opener.current?.focus({ preventScroll: true })); }}>
      <ReadingForm draft={draft} setDraft={setDraft} saving={saving} error={error} discardRequested={discardRequested}
        onSave={(value) => void save(value)} onCancel={() => void dismiss('cancel')}
        onDiscard={() => void dismiss('discard')} onKeepEditing={() => setDiscardRequested(false)} />
    </Surface>
  </>;
}

export function FitExperience(props: { Surface: SurfaceComponent; kind: string }) {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Experience {...props} /></BrowserRouter>;
}
