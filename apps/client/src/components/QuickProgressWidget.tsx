import { useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { Book } from "@/types";
import { updateBookQuickProgress } from "@/services/api";
import "./reading-progress/correction.css";

interface QuickProgressWidgetProps {
  book: Book;
  onUpdate: () => void | Promise<unknown>;
}

export const QuickProgressWidget = ({ book, onUpdate }: QuickProgressWidgetProps) => {
  const { user, loading } = useAuth();
  // A new reader/book owns a new draft; old writes may finish, but cannot present
  // their result inside that replacement task (including auth initialization).
  const owner = `${book.user_id}:${book.id}:${loading ? "loading" : user?.id ?? "signed-out"}`;
  return <PageCorrection key={owner} book={book} onUpdate={onUpdate}
    canEdit={!loading && user?.id === book.user_id} />;
};

function PageCorrection({ book, onUpdate, canEdit }: QuickProgressWidgetProps & { canEdit: boolean }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const locked = useRef(false);
  const dirty = useRef(false);
  const revision = useRef(0);
  const recordedPage = book.current_page ?? 0;
  const [savedPage, setSavedPage] = useState(recordedPage);
  const [currentPage, setCurrentPage] = useState(String(recordedPage));
  const [updating, setUpdating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const total = typeof book.pages === "number" && Number.isFinite(book.pages) && book.pages > 0
    ? book.pages : null;
  const value = currentPage.trim();
  const parsedPage = /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
  const validPage = parsedPage !== null && (total === null || parsedPage <= total);
  const unchanged = validPage && parsedPage === savedPage;

  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useLayoutEffect(() => {
    setSavedPage(recordedPage);
    if (!dirty.current && !locked.current) setCurrentPage(String(recordedPage));
  }, [recordedPage]);

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || locked.current || unchanged) return;
    if (!validPage || parsedPage === null) {
      setValidationError(parsedPage === null
        ? "Enter a whole page number of 0 or more."
        : `This book has ${total} pages. Enter a page from 0 to ${total}.`);
      inputRef.current?.focus();
      return;
    }
    locked.current = true;
    const request = ++revision.current;
    setUpdating(true);
    setSaveError(null);
    setValidationError(null);
    setStatus("");
    try {
      await updateBookQuickProgress(book, parsedPage);
      if (!mounted.current) return;
      dirty.current = false;
      setSavedPage(parsedPage);
      setCurrentPage(String(parsedPage));
      setStatus(`Page ${parsedPage} saved on this device.`);
      // Refresh is a separate presentation operation. Its failure must never
      // turn a confirmed local write into a retry of that same correction.
      void Promise.resolve().then(() => {
        if (mounted.current && revision.current === request) return onUpdate();
      }).catch(() => {
        if (mounted.current && revision.current === request) {
          setStatus(`Page ${parsedPage} saved on this device. The book view couldn't refresh; reopen it to load the saved page.`);
        }
      });
    } catch {
      if (mounted.current) setSaveError("We couldn't save this page. Your correction is still here. Try again.");
    } finally {
      if (mounted.current) { locked.current = false; setUpdating(false); }
    }
  };

  return (
    <section className="reading-correction" aria-labelledby={`${id}-heading`}>
      <header>
        <h2 id={`${id}-heading`}>Correct current page</h2>
        <p id={`${id}-help`}>Use Log progress when you have read. Corrections do not add reading activity or streaks.</p>
      </header>
      <form noValidate aria-labelledby={`${id}-heading`} onSubmit={handleUpdate} aria-busy={updating}>
        <p className="reading-correction-saved">Saved page {savedPage}{total !== null ? ` of ${total}` : ""}</p>
        <div className="reading-correction-row">
          <div className="reading-correction-field">
            <label htmlFor={`${id}-page`}>Current Page</label>
            <input ref={inputRef} id={`${id}-page`} type="text" inputMode="numeric" autoComplete="off"
              value={currentPage} disabled={updating || !canEdit}
              aria-invalid={Boolean(validationError)}
              aria-describedby={[`${id}-help`, validationError ? `${id}-error` : null].filter(Boolean).join(" ")}
              onChange={event => {
                if (locked.current || !canEdit) return;
                revision.current += 1;
                dirty.current = event.target.value !== String(savedPage);
                setCurrentPage(event.target.value);
                setValidationError(null);
                setSaveError(null);
                setStatus("");
              }} />
          </div>
          <button type="submit" disabled={updating || !canEdit || unchanged}>
            {updating ? "Correcting…" : "Correct page"}
          </button>
        </div>
        {validPage && total !== null && parsedPage === total && book.status !== "completed" && (
          <p className="reading-correction-note">Saving the last page also marks this book finished.</p>
        )}
        {validPage && parsedPage !== null && !unchanged && book.status === "completed" && (total === null || parsedPage < total) && (
          <p className="reading-correction-note">This book keeps its finished status. Use Edit book to change its reading status.</p>
        )}
        {validationError && <p id={`${id}-error`} role="alert" className="reading-correction-error">{validationError}</p>}
        {saveError && <p role="alert" className="reading-correction-error">{saveError}</p>}
        <p role="status" className="reading-correction-status">{updating ? "Saving your correction…" : status}</p>
      </form>
    </section>
  );
}
