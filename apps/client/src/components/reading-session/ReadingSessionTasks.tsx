/* eslint-disable react-refresh/only-export-components -- Context and its app-owned task are one boundary. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { useNavigate } from "react-router-dom";
import { Book, Play } from "iconoir-react";
import { toast } from "sonner";
import { useTimer } from "@/contexts/TimerContext";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { Dialog } from "@/components/ui/dialog";
import { AdaptiveDialogBody, AdaptiveDialogContent, AdaptiveDialogDescription, AdaptiveDialogHeader, AdaptiveDialogTitle } from "@/components/ui/adaptive-dialog";
import { LoadingError, LoadingRegion } from "@/components/loading/LoadingRegion";
import { Skeleton } from "@/components/ui/skeleton";
import "./reading-session.css";

type OpenPicker = (invoker: HTMLElement | null) => void;
const ReadingSessionTasks = createContext<OpenPicker | null>(null);
export function useReadingSessionTasks() {
  const openPicker = useContext(ReadingSessionTasks);
  if (!openPicker) throw new Error("Reading session tasks require their app-owned provider");
  return openPicker;
}

/** Keep a single task alive while route headers and responsive controls change. */
export function ReadingSessionTasksProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth();
  const { clientSessionId, isStarting = false, isSaving = false, saveFrozen = false } = useTimer();
  const [task, setTask] = useState<{ owner: string; session: string | null; invoker: HTMLElement | null } | null>(null);
  const lastInvoker = useRef<HTMLElement | null>(null);
  const openPicker = useCallback<OpenPicker>(invoker => {
    if (!user || authLoading || isStarting) return;
    if (isSaving || saveFrozen) {
      toast.info(isSaving ? "Your reading session is being saved." : "Open timer Details to finish saving your reading session.");
      return;
    }
    lastInvoker.current = invoker;
    setTask({ owner: user.id, session: clientSessionId, invoker });
  }, [user, authLoading, isStarting, isSaving, saveFrozen, clientSessionId]);
  const open = Boolean(task && !authLoading && task.owner === user?.id && task.session === clientSessionId);
  useEffect(() => { if (task && !open) setTask(null); }, [task, open]);
  return <ReadingSessionTasks.Provider value={openPicker}>
    {children}
    <Dialog open={open} onOpenChange={next => { if (!next && !isStarting) setTask(null); }}>
      {open && <AdaptiveDialogContent size="compact" className="reading-picker" showClose={!isStarting} aria-busy={isStarting}
        onCloseAutoFocus={event => {
          event.preventDefault();
          const active = document.activeElement?.closest('[role="dialog"], [role="alertdialog"]');
          if (active && active !== event.target && active.getAttribute("data-state") !== "closed") return;
          const invoker = lastInvoker.current;
          const target = invoker?.isConnected && invoker.getClientRects().length ? invoker
            : document.querySelector<HTMLElement>('[aria-label="Open timer details"], [data-start-reading-timer]')
              ?? document.querySelector<HTMLElement>("[data-app-scroll-container] h1");
          if (target) { if (!target.hasAttribute("tabindex")) target.tabIndex = -1; target.focus(); }
        }}>
        <AdaptiveDialogHeader>
          <AdaptiveDialogTitle>Start reading timer</AdaptiveDialogTitle>
          <AdaptiveDialogDescription>Settle into a book. We will keep the time for you.</AdaptiveDialogDescription>
        </AdaptiveDialogHeader>
        <AdaptiveDialogBody><ConnectedPicker onNavigate={() => setTask(null)} /></AdaptiveDialogBody>
      </AdaptiveDialogContent>}
    </Dialog>
  </ReadingSessionTasks.Provider>;
}

function ConnectedPicker({ onNavigate }: { onNavigate: () => void }) {
  const { user } = useAuth();
  const { books, loading, refreshing, hasLoaded, error, refetchBooks } = useBooks(user?.id);
  const { startTimer, isStarting = false, isVisible, bookId } = useTimer();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  return <TimerPickerContent loading={loading} refreshing={refreshing} hasLoaded={hasLoaded} error={error}
    onRetry={() => void refetchBooks()} readingBooks={books.filter(book => book.status === "reading")}
    starting={isStarting} selected={selected}
    onStartTimer={(id, title) => { setSelected(id); startTimer(id, title); if (isVisible && bookId === id) onNavigate(); }}
    onGoToLibrary={() => { onNavigate(); navigate("/my-books"); }} onAddBook={() => { onNavigate(); navigate("/add-book"); }} />;
}

type TimerPickerContentProps = {
  loading: boolean; refreshing?: boolean; hasLoaded?: boolean; error?: string | null; onRetry?: () => void;
  readingBooks: Array<{ id: string; title: string; author?: string | null; cover_url?: string | null; current_page?: number | null; pages?: number | null }>;
  starting?: boolean; selected?: string | null;
  onStartTimer: (bookId: string, title: string) => void; onGoToLibrary: () => void; onAddBook: () => void;
};

export function TimerPickerContent({ loading, refreshing, hasLoaded, error, onRetry, readingBooks, starting = false,
  selected, onStartTimer, onGoToLibrary, onAddBook }: TimerPickerContentProps) {
  return <LoadingRegion loading={loading} refreshing={refreshing} label="Loading books for the reading timer">
    {error && <LoadingError message="Reading books could not be refreshed." onRetry={onRetry} />}
    {loading ? <div className="reading-picker__loading" data-loading-contract="timer-picker" aria-hidden="true">
      {[0, 1, 2].map(index => <Skeleton key={index} className="h-20 w-full" />)}
    </div> : error && !hasLoaded ? null : readingBooks.length ? <>
      <p className="reading-picker__label">On your reading shelf</p>
      <ul className="reading-picker__list">{readingBooks.map(book => <li key={book.id}>
        <button type="button" className="reading-picker__book" disabled={starting} onClick={() => onStartTimer(book.id, book.title)}>
          {book.cover_url ? <img src={book.cover_url} alt="" className="reading-picker__cover" /> : <span className="reading-picker__cover reading-picker__placeholder"><Book aria-hidden="true" /></span>}
          <span className="reading-picker__copy"><span className="reading-picker__title">{book.title}</span>
            {book.author && <span className="reading-picker__author">{book.author}</span>}
            {typeof book.current_page === "number" && book.pages ? <span className="reading-picker__place">Page {book.current_page} of {book.pages}</span> : null}
          </span>
          <Play className="reading-picker__play" aria-hidden="true" />
        </button>
      </li>)}</ul>
    </> : <div className="reading-picker__empty">
      <Book aria-hidden="true" />
      <h3>No reading books</h3>
      <p>Mark a book as reading in your Library, then come back to start a session.</p>
      <div className="reading-session__actions"><button type="button" className="reading-session__button" onClick={onGoToLibrary}>Library</button>
        <button type="button" className="reading-session__button reading-session__primary" onClick={onAddBook}>Add Book</button></div>
    </div>}
    <p role="status" className="reading-session__hint">{starting ? `Starting ${readingBooks.find(book => book.id === selected)?.title ?? "your session"}...` : ""}</p>
  </LoadingRegion>;
}
