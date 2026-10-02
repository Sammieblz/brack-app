import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppBackButton } from "@/components/AppBackButton";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileLayout } from "@/components/MobileLayout";
import { LoadingError, LoadingRegion } from "@/components/loading/LoadingRegion";
import { EditBookSkeleton } from "@/components/skeletons/ReadingRouteSkeletons";
import { ImagePickerDialog } from "@/components/ImagePickerDialog";
import { DatePicker } from "@/components/ui/date-picker";
import { useAuth } from "@/hooks/useAuth";
import { useAppBack } from "@/hooks/useAppBack";
import { useUnsavedAppBack } from "@/hooks/useUnsavedAppBack";
import { useRetainedReaderResource } from "@/hooks/useRetainedReaderResource";
import { useUIEnvironmentValue } from "@/hooks/useUIEnvironment";
import { useToast } from "@/hooks/use-toast";
import { fetchBookById, uploadPublicStorageFile } from "@/services/api";
import { booksRepo, createLocalId } from "@/services/local";
import { isConnectivityAvailable } from "@/services/connectivity";
import { bookOperations } from "@/utils/offlineOperation";
import { BookEditorValidationError, buildBookEditorPatch, createBookEditorDraft, reconcileBookEditorDraft, type BookEditorDraft } from "@/lib/bookEditor";
import { normalizeDateOnly, todayDateOnly } from "@/lib/dateOnly";
import type { Book } from "@/types";
import "@/components/reading-progress/book-editor.css";

type CoverSelection = { dataUrl: string; format: string; base64?: string };

function EditorFrame({ id, children }: { id?: string; children: ReactNode }) {
  const compact = useUIEnvironmentValue(environment => environment.windowClass !== "expanded");
  const to = id ? `/book/${id}` : "/my-books";
  return <MobileLayout>
    {compact && <MobileHeader title="Edit book" back={{ label: "Book", ariaLabel: "Back to book", to }} />}
    <div className="app-page-form book-editor pb-12">
      {!compact && <AppBackButton label="Book" ariaLabel="Back to book" to={to} showLabel variant="outline" className="mb-4" />}
      <header className="book-editor-heading">{!compact && <h1>Edit book</h1>}<p>Keep your book details and saved place accurate. These changes do not add reading activity.</p></header>
      {children}
    </div>
  </MobileLayout>;
}

export default function EditBook() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  if (loading || !user || !id) return <EditorFrame id={id}><LoadingRegion loading={Boolean(loading)} label="Loading book editor">
    {loading ? <EditBookSkeleton /> : <p role="status">{user ? "This book is unavailable." : "Sign in to edit this book."}</p>}
  </LoadingRegion></EditorFrame>;
  return <OwnedBookEditor key={`${user.id}:${id}`} id={id} userId={user.id} />;
}

function OwnedBookEditor({ id, userId }: { id: string; userId: string }) {
  const epoch = useRef(0);
  useLayoutEffect(() => { const current = ++epoch.current; return () => { epoch.current = current + 1; }; }, []);
  const readBook = useCallback(async () => {
    const current = epoch.current;
    const assertCurrent = () => { if (current !== epoch.current) throw new Error("This editor is no longer active"); };
    const local = await booksRepo.get(id);
    assertCurrent();
    if (local) {
      if (local.id !== id || local.user_id !== userId || local.deleted_at) throw new Error("This book is unavailable for this account.");
      return local;
    }
    if (!isConnectivityAvailable()) throw new Error("This book is not on this device yet. Reconnect and try again.");
    const remote = await fetchBookById(id);
    assertCurrent();
    if (!remote || remote.id !== id || remote.user_id !== userId || remote.deleted_at) throw new Error("This book is unavailable for this account.");
    const [book] = await booksRepo.upsertRemoteManyPreservingLocal(userId, [remote]);
    assertCurrent();
    if (!book || book.id !== id || book.user_id !== userId || book.deleted_at) throw new Error("This book is unavailable for this account.");
    return book;
  }, [id, userId]);
  const { data: book, loading, error, refetch } = useRetainedReaderResource(`${userId}:${id}`, readBook);
  return <EditorFrame id={id}>{book ? <BookEditorForm initialBook={book} userId={userId} /> :
    <LoadingRegion loading={loading} label="Loading book editor">{loading ? <EditBookSkeleton /> :
      <LoadingError message={error?.message ?? "This book is unavailable."} onRetry={() => void refetch()} />}</LoadingRegion>}
  </EditorFrame>;
}

function BookEditorForm({ initialBook, userId }: { initialBook: Book; userId: string }) {
  const [baseline, setBaseline] = useState(initialBook);
  const initial = createBookEditorDraft(baseline);
  const [draft, setDraft] = useState(() => createBookEditorDraft(initialBook));
  const [newTag, setNewTag] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selection, setSelection] = useState<CoverSelection | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [startValid, setStartValid] = useState(true);
  const [finishValid, setFinishValid] = useState(true);
  const [editionOpen, setEditionOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const lock = useRef(false);
  const uploadLock = useRef(false);
  const epoch = useRef(0);
  const form = useRef<HTMLFormElement>(null);
  const coverTrigger = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { goBack } = useAppBack({ to: `/book/${initialBook.id}` });
  useLayoutEffect(() => { const current = ++epoch.current; return () => { epoch.current = current + 1; }; }, []);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial) || Boolean(newTag.trim() || selection) || !startValid || !finishValid;
  useUnsavedAppBack({ dirty, pending: saving || uploading });
  const change = <K extends keyof BookEditorDraft>(field: K, value: BookEditorDraft[K]) => {
    setDraft(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: "", ...(field === "pages" ? { current_page: "" } : {}) }));
    setSaveError(null);
  };
  const showErrors = (next: Record<string, string>) => {
    setErrors(next);
    if (["pages", "chapters", "series_position", "series_total"].some(field => next[field])) setEditionOpen(true);
    const current = epoch.current;
    requestAnimationFrame(() => {
      if (current === epoch.current) form.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
    });
  };
  const uploadCover = async (image: CoverSelection) => {
    if (uploadLock.current || lock.current) return;
    uploadLock.current = true;
    const current = epoch.current;
    setSelection(image); setUploading(true); setCoverError(null);
    try {
      if (!image.base64) throw new Error("This image could not be read. Choose it again.");
      const bytes = Uint8Array.from(atob(image.base64), character => character.charCodeAt(0));
      const type = `image/${image.format}`;
      const url = await uploadPublicStorageFile("book-covers", `${userId}/${createLocalId()}.${image.format}`, new Blob([bytes], { type }), { contentType: type });
      if (current !== epoch.current) return;
      setDraft(previous => ({ ...previous, cover_url: url }));
      setSelection(null);
    } catch (error) {
      if (current === epoch.current) setCoverError(error instanceof Error ? error.message : "The cover could not be uploaded. Retry or remove this selection.");
    } finally {
      if (current === epoch.current) { uploadLock.current = false; setUploading(false); }
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current || uploadLock.current || selection || !startValid || !finishValid) return;
    const validated = buildBookEditorPatch(baseline, draft, newTag);
    if (Object.keys(validated.errors).length) { showErrors(validated.errors); return; }
    setErrors({}); setSaveError(null);
    if (!Object.keys(validated.patch).length) { navigate(`/book/${initialBook.id}`); return; }
    lock.current = true; setSaving(true);
    const current = epoch.current;
    const isCurrent = () => current === epoch.current;
    try {
      await bookOperations.update(initialBook.id, validated.patch, { expectedUserId: userId, isCurrent });
    } catch (error) {
      if (isCurrent()) {
        if (error instanceof BookEditorValidationError) {
          if (error.latestBook) {
            const latest = error.latestBook;
            setDraft(previous => reconcileBookEditorDraft(baseline, latest, previous));
            setBaseline(latest);
          }
          showErrors(error.fields);
        }
        const message = error instanceof Error ? error.message : "Your changes could not be saved. Your draft is still here.";
        setSaveError(message);
        toast({ title: "Changes not saved", description: message, variant: "destructive" });
      }
      return;
    } finally {
      if (isCurrent()) { lock.current = false; setSaving(false); }
    }
    if (!isCurrent()) return;
    toast({ title: "Book changes saved on this device", description: "They will sync when a connection is available." });
    navigate(`/book/${initialBook.id}`);
  };
  const field = (name: keyof BookEditorDraft, label: string, numeric = false) => <div className="book-editor-field">
    <label htmlFor={name}>{label}</label><input id={name} value={String(draft[name] ?? "")} required={name === "title"}
      inputMode={name === "series_position" ? "decimal" : numeric ? "numeric" : undefined}
      aria-invalid={Boolean(errors[name])} aria-describedby={[name === "current_page" ? "book-page-limit" : "", errors[name] ? `${name}-error` : ""].filter(Boolean).join(" ") || undefined}
      onChange={event => change(name, event.target.value)} />
    {name === "current_page" && <p id="book-page-limit" className="book-editor-note">Total pages: {draft.pages || "not set"}. Change this in Edition and series.</p>}
    {errors[name] && <p className="book-editor-error" id={`${name}-error`} role="alert">{errors[name]}</p>}
  </div>;
  const today = todayDateOnly();
  const finished = normalizeDateOnly(draft.date_finished);
  const addTag = () => { const tag = newTag.trim(); if (tag && !draft.tags.includes(tag)) change("tags", [...draft.tags, tag]); setNewTag(""); };
  return <form ref={form} onSubmit={event => void submit(event)} noValidate aria-label="Book details">
    <fieldset className="book-editor-fields" disabled={saving}>
      <section className="book-editor-section" aria-labelledby="book-identity-heading"><h2 id="book-identity-heading">Book essentials</h2>
        <div className="book-editor-grid">{field("title", "Title *")}{field("author", "Author")}</div>
      </section>
      <section className="book-editor-section" aria-labelledby="book-reading-heading"><h2 id="book-reading-heading">Reading details</h2>
        <p className="book-editor-note" id="metadata-correction">Correct your saved place, status and dates. This does not log reading time, add activity or award points.</p>
        <div className="book-editor-grid"><div className="book-editor-row">
          {field("current_page", "Current Page", true)}
          <div className="book-editor-field"><label htmlFor="status">Status</label><select id="status" value={draft.status} onChange={event => change("status", event.target.value)}>
            <option value="reading">Currently Reading</option><option value="completed">Completed</option><option value="to_read">Want to Read</option>
            {!["reading", "completed", "to_read"].includes(draft.status) && <option value={draft.status}>{draft.status}</option>}
          </select></div>
          <div className="book-editor-field"><label htmlFor="rating">Rating</label><select id="rating" value={draft.rating} aria-invalid={Boolean(errors.rating)} aria-describedby={errors.rating ? "rating-error" : undefined} onChange={event => change("rating", event.target.value)}>
            <option value="">No rating</option>{[1, 2, 3, 4, 5].map(number => <option key={number} value={number}>{number} {number === 1 ? "star" : "stars"}</option>)}
            {draft.rating && !["1", "2", "3", "4", "5"].includes(draft.rating) && <option value={draft.rating}>Stored rating: {draft.rating}</option>}
          </select>{errors.rating && <p id="rating-error" role="alert" className="book-editor-error">{errors.rating}</p>}</div>
        </div><div className="book-editor-row">
          <DatePicker id="date_started" label="Date Started" value={draft.date_started} onChange={value => change("date_started", value)} maxDate={finished && finished < today ? finished : today} showToday disabled={saving} onValidityChange={setStartValid} />
          <DatePicker id="date_finished" label="Date Finished" value={draft.date_finished} onChange={value => change("date_finished", value)} minDate={draft.date_started} maxDate={today} showToday disabled={saving} onValidityChange={setFinishValid} />
        </div></div>
      </section>
      <details className="book-editor-details" open={editionOpen} onToggle={event => setEditionOpen(event.currentTarget.open)}><summary>Edition and series <span>Pages, ISBN and more</span></summary>
        <div className="book-editor-grid"><div className="book-editor-row">{field("pages", "Total Pages", true)}{field("chapters", "Total Chapters", true)}</div>
          <div className="book-editor-row">{field("genre", "Genre")}{field("isbn", "ISBN")}</div>{field("series_name", "Series")}
          <div className="book-editor-row">{field("series_position", "Book #", true)}{field("series_total", "Series total", true)}</div>
        </div>
      </details>
      <details className="book-editor-details" open={coverOpen} onToggle={event => setCoverOpen(event.currentTarget.open)}><summary>Cover image <span>Photo or image URL</span></summary>
        <div className="book-editor-grid"><div className="book-editor-cover">
          {draft.cover_url && <img src={draft.cover_url} alt={`Cover of ${draft.title || "this book"}`} />}
          <div className="book-editor-cover-controls"><button ref={coverTrigger} type="button" className="book-editor-control" aria-disabled={uploading} onClick={() => { if (!uploadLock.current) setPickerOpen(true); }}>Choose Image</button>
            {draft.cover_url && <button type="button" className="book-editor-control" disabled={uploading} onClick={() => change("cover_url", "")}>Remove cover</button>}
          </div>
        </div>
          <div className="book-editor-field"><label htmlFor="cover_url">Cover image URL</label><input id="cover_url" value={draft.cover_url} disabled={uploading} onChange={event => change("cover_url", event.target.value)} inputMode="url" /></div>
          {uploading && <p className="book-editor-note" role="status">Uploading cover...</p>}
          {selection && !uploading && <div className="book-editor-grid"><img src={selection.dataUrl} alt="Selected cover awaiting upload" className="max-h-36 max-w-full object-contain" />
            <div className="book-editor-cover-controls"><button type="button" className="book-editor-control" onClick={() => void uploadCover(selection)}>Retry cover upload</button>
              <button type="button" className="book-editor-control" onClick={() => { setSelection(null); setCoverError(null); }}>Remove selection</button></div>
          </div>}
          {coverError && <p role="alert" className="book-editor-error">{coverError}</p>}
          <p className="book-editor-note">Uploading needs a connection. Your existing cover stays until its replacement is ready. Save Changes applies the cover to this book.</p>
        </div>
      </details>
      <details className="book-editor-details" open={notesOpen} onToggle={event => setNotesOpen(event.currentTarget.open)}><summary>Notes and tags <span>Your own organization</span></summary>
        <div className="book-editor-grid"><div className="book-editor-field"><label htmlFor="notes">Notes</label><textarea id="notes" rows={6} value={draft.notes} onChange={event => change("notes", event.target.value)} /></div>
          <div className="book-editor-field"><label htmlFor="new-tag">Add a tag</label><input id="new-tag" value={newTag} aria-describedby="tag-hint" onChange={event => setNewTag(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); addTag(); } }} />
            <p id="tag-hint" className="book-editor-note">Use Add tag or Enter. Save Changes also includes a tag you are still typing.</p>
            <button type="button" className="book-editor-control justify-self-start" disabled={!newTag.trim()} onClick={addTag}>Add tag</button></div>
          {draft.tags.length > 0 && <ul className="book-editor-tags" aria-label="Book tags">{draft.tags.map(tag => <li className="book-editor-tag" key={tag}><span>{tag}</span><button type="button" className="book-editor-control" aria-label={`Remove tag ${tag}`} onClick={() => change("tags", draft.tags.filter(value => value !== tag))}>Remove</button></li>)}</ul>}
        </div>
      </details>
    </fieldset>
    {saveError && <p role="alert" id="book-save-error" className="book-editor-error mt-4">{saveError}</p>}
    <div className="book-editor-actions"><button type="submit" className="book-editor-control book-editor-save" disabled={saving || uploading || Boolean(selection) || !startValid || !finishValid} aria-describedby={saveError ? "book-save-error" : undefined}>{saving ? "Saving..." : "Save Changes"}</button>
      <button type="button" className="book-editor-control" disabled={saving || uploading} onClick={() => void goBack()}>Cancel</button>
      <p className="book-editor-note">Book details save on this device first, including when you are offline.</p>
    </div>
    <ImagePickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onImagePicked={image => void uploadCover(image)} title="Choose Cover Image" description="Take a photo or select from your library" returnFocusRef={coverTrigger} />
  </form>;
}
