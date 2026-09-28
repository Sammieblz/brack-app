import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import {
  IonApp, IonButtons, IonContent, IonHeader, IonLabel, IonPage, IonRouterOutlet,
  IonTabBar, IonTabButton, IonTabs, IonToolbar, setupIonicReact, useIonRouter,
  useIonViewDidEnter, useIonViewWillEnter, useIonViewWillLeave,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Book, Clock, NavArrowLeft } from 'iconoir-react';
import '@/index.css';
import '@ionic/react/css/core.css';
// Deliberately confined to this HTML entry: structure.css fixes the document
// and gives Ionic ownership of scrolling. It is not a production CSS import.
import '@ionic/react/css/structure.css';
import './navigation.css';
import { initializeTheme } from './theme';

initializeTheme();
const search = new URLSearchParams(window.location.search);
const runtime = search.get('runtime') === 'native' ? 'native' : 'browser';
const mode = search.get('mode') === 'ios' ? 'ios' : 'md';
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const to = (pathname: string) => `${pathname}${search.size ? `?${search}` : ''}`;
// The outlet owns the live reduced-motion choice. A global false would keep
// transitions disabled after the preference changes back until a full reload.
setupIonicReact({ mode, animated: true, swipeBackEnabled: runtime === 'native' && mode === 'ios' });

type TimerState = { running: boolean; elapsedSeconds: number };
type PageLifecycle = { instance: number; name: string; active: boolean; enters: number; leaves: number; pulses: number };
type Transition = { page: string; durationMs: number };
const lifecycle = new Map<number, PageLifecycle>();
const transitions: Transition[] = [];
let pageSequence = 0;
let readerSequence = 0;
let mountedPages = 0;
let unmountedPages = 0;
const PULSE_EVENT = 'brack-ionic-navigation-probe';

type ReaderState = {
  draft: string;
  setDraft: (value: string) => void;
  timer: TimerState;
  startTimer: () => void;
};
const ReaderContext = createContext<ReaderState | null>(null);
const useReader = () => {
  const reader = useContext(ReaderContext);
  if (!reader) throw new Error('Navigation fixture requires ReaderContext');
  return reader;
};

export interface IonicNavigationSnapshot {
  runtime: 'native' | 'browser';
  mode: 'ios' | 'md';
  reducedMotion: boolean;
  route: string;
  draft: string;
  timer: TimerState;
  readerOwner: number;
  pages: PageLifecycle[];
  activePages: string[];
  retainedPages: number;
  visiblePages: number;
  mountedPages: number;
  unmountedPages: number;
  transitions: Transition[];
}
declare global {
  interface Window {
    ionicNavigationFixture: {
      snapshot: () => IonicNavigationSnapshot;
      advanceTimer: (seconds: number) => void;
      pulseSubscriptions: () => void;
    };
  }
}

function FixturePage({ name, title, fallback, children }: {
  name: string; title: string; fallback?: string; children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const router = useIonRouter();
  const [record] = useState<PageLifecycle>(() => ({ instance: ++pageSequence, name, active: false, enters: 0, leaves: 0, pulses: 0 }));
  const enterStart = useRef(0);
  const unsubscribe = useRef<(() => void) | undefined>(undefined);
  const stop = useCallback(() => { unsubscribe.current?.(); unsubscribe.current = undefined; record.active = false; }, [record]);
  useEffect(() => {
    mountedPages += 1;
    lifecycle.set(record.instance, record);
    return () => { stop(); lifecycle.delete(record.instance); unmountedPages += 1; };
  }, [record, stop]);
  useIonViewWillEnter(() => { enterStart.current = performance.now(); }, []);
  useIonViewDidEnter(() => {
    stop();
    record.active = true;
    record.enters += 1;
    const pulse = () => { record.pulses += 1; };
    window.addEventListener(PULSE_EVENT, pulse);
    unsubscribe.current = () => window.removeEventListener(PULSE_EVENT, pulse);
    transitions.push({ page: name, durationMs: Math.round((performance.now() - enterStart.current) * 100) / 100 });
    if (transitions.length > 100) transitions.shift();
    // Explicit app focus policy; Ionic retention alone is not a focus policy.
    // preventScroll avoids resetting the retained IonContent scroll position.
    heading.current?.focus({ preventScroll: true });
  }, [name, record, stop]);
  useIonViewWillLeave(() => { record.leaves += 1; stop(); }, [record, stop]);
  const back = () => {
    if (router.canGoBack()) router.goBack();
    else router.navigateRoot(to(fallback ?? '/library'));
  };
  return <IonPage className="fixture-page" data-page={name}>
    <IonHeader><IonToolbar>
      {fallback && <IonButtons slot="start"><button className="fixture-back" type="button" onClick={back} aria-label="Go back">
        <NavArrowLeft aria-hidden="true" /><span>Back</span>
      </button></IonButtons>}
      <h1 ref={heading} tabIndex={-1} className="fixture-title">{title}</h1>
    </IonToolbar></IonHeader>
    <IonContent role="main" aria-label={title}>
      <div className="fixture-content">
        <p className="fixture-kicker">BRACK · Navigation experiment</p>
        <p className="fixture-caption">Synthetic books and session state. No account data.</p>
        {children}
      </div>
    </IonContent>
  </IonPage>;
}

function Library() {
  return <FixturePage name="library" title="Library">
    <p className="fixture-intro">A quiet place for your next chapter.</p>
    <ol className="fixture-books">
      {Array.from({ length: 48 }, (_, index) => <li key={index}>
        <Link to={to(`/library/book/${index + 1}`)} className="fixture-book" aria-label={`Open reading book ${index + 1}`}>
          <span className="fixture-cover" aria-hidden="true"><Book /></span>
          <span><strong>Reading book {index + 1}</strong><span className="fixture-author">A synthetic reading collection</span></span>
        </Link>
      </li>)}
    </ol>
  </FixturePage>;
}

function BookDetail() {
  const { id = '1' } = useParams();
  const { draft, setDraft, timer, startTimer } = useReader();
  return <FixturePage name={`book-${id}`} title={`Reading book ${id}`} fallback="/library">
    <div className="fixture-detail-cover" aria-hidden="true"><Book /></div>
    <p className="fixture-intro">Keep a thought from this chapter.</p>
    <label htmlFor={`draft-${id}`}>Reading note</label>
    <textarea id={`draft-${id}`} value={draft} onChange={(event) => setDraft(event.target.value)} rows={5} />
    <p className="fixture-caption">This experiment keeps the draft in memory above the navigation stack.</p>
    <button type="button" className="fixture-primary" disabled={timer.running} onClick={startTimer}>
      {timer.running ? 'Reading timer running' : 'Start reading timer'}
    </button>
    <p><output aria-label="Synthetic elapsed seconds">{timer.elapsedSeconds}</output> synthetic elapsed seconds</p>
  </FixturePage>;
}

function Reading() {
  const { timer } = useReader();
  return <FixturePage name="reading" title="Reading">
    <div className="fixture-reading-card"><Clock aria-hidden="true" /><h2>Your reading session</h2>
      <p>{timer.running ? 'Session running' : 'Ready when you are'}</p>
      <p><output aria-label="Synthetic elapsed seconds">{timer.elapsedSeconds}</output> synthetic elapsed seconds</p>
      <Link to={to('/reading/session')} className="fixture-link">Open reading session</Link>
    </div>
  </FixturePage>;
}

function ReadingSession() {
  const { timer, draft } = useReader();
  return <FixturePage name="session" title="Reading session" fallback="/reading">
    <p><output aria-label="Synthetic elapsed seconds">{timer.elapsedSeconds}</output> synthetic elapsed seconds</p>
    <p>{timer.running ? 'Session running' : 'Session not started'}</p>
    <h2>Your reading note</h2><p data-testid="session-draft">{draft || 'No note yet.'}</p>
  </FixturePage>;
}

export function NavigationFixture() {
  const [readerOwner] = useState(() => ++readerSequence);
  const [draft, setDraft] = useState('');
  const [timer, setTimer] = useState<TimerState>({ running: false, elapsedSeconds: 0 });
  const [reducedMotion, setReducedMotion] = useState(motionQuery.matches);
  const state = useRef({ draft, timer, reducedMotion });
  state.current = { draft, timer, reducedMotion };
  useEffect(() => {
    const change = () => setReducedMotion(motionQuery.matches);
    motionQuery.addEventListener('change', change);
    window.ionicNavigationFixture = {
      snapshot: () => {
        const pages = [...lifecycle.values()].map((page) => ({ ...page }));
        const elements = [...document.querySelectorAll<HTMLElement>('.fixture-page')];
        return { runtime, mode, ...state.current, route: window.location.pathname, readerOwner,
          pages, activePages: pages.filter((page) => page.active).map((page) => page.name),
          retainedPages: elements.length,
          visiblePages: elements.filter((page) => getComputedStyle(page).display !== 'none' && page.getAttribute('aria-hidden') !== 'true').length,
          mountedPages, unmountedPages, transitions: transitions.map((transition) => ({ ...transition })) };
      },
      advanceTimer: (seconds) => {
        if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Expected a non-negative synthetic duration');
        setTimer((current) => current.running ? { ...current, elapsedSeconds: current.elapsedSeconds + seconds } : current);
      },
      pulseSubscriptions: () => window.dispatchEvent(new Event(PULSE_EVENT)),
    };
    return () => { motionQuery.removeEventListener('change', change); };
  }, [readerOwner]);
  return <ReaderContext.Provider value={{ draft, setDraft, timer, startTimer: () => setTimer((current) => ({ ...current, running: true })) }}>
    <IonApp className="navigation-fixture" data-runtime={runtime} data-mode={mode} data-reduced-motion={String(reducedMotion)}>
      <IonReactRouter basename="/navigation.html">
        <IonTabs>
          <IonRouterOutlet animated={!reducedMotion} swipeGesture={runtime === 'native' && mode === 'ios'}>
            <Routes>
              <Route path="/library" element={<Library />} />
              <Route path="/library/book/:id" element={<BookDetail />} />
              <Route path="/reading" element={<Reading />} />
              <Route path="/reading/session" element={<ReadingSession />} />
              <Route path="*" element={<Navigate to={to('/library')} replace />} />
            </Routes>
          </IonRouterOutlet>
          <IonTabBar slot={runtime === 'native' ? 'bottom' : 'top'} aria-label="Reading destinations">
            <IonTabButton tab="library" href={to('/library')}><Book aria-hidden="true" /><IonLabel>Library</IonLabel></IonTabButton>
            <IonTabButton tab="reading" href={to('/reading')}><Clock aria-hidden="true" /><IonLabel>Reading</IonLabel></IonTabButton>
          </IonTabBar>
        </IonTabs>
      </IonReactRouter>
    </IonApp>
  </ReaderContext.Provider>;
}

createRoot(document.getElementById('root')!).render(<NavigationFixture />);
