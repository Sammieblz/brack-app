import { useId, useLayoutEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { Dialog } from "./ui/dialog";
import { AdaptiveDialogBody, AdaptiveDialogContent, AdaptiveDialogDescription, AdaptiveDialogFooter, AdaptiveDialogHeader, AdaptiveDialogTitle } from "./ui/adaptive-dialog";
import { MobileAlertDialog } from "./ui/mobile-dialog";
import { ImagePickerDialog } from "./ImagePickerDialog";
import type { PickedImage } from "@/hooks/useImagePicker";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { emitBooksChanged, uploadPublicStorageFile } from "@/services/api";
import { createLocalId } from "@/services/local";
import { readingCoreSync } from "@/services/sync/engine";
import { isConnectivityAvailable } from "@/services/connectivity";
import { createProgressCapture, persistProgressCapture, type ProgressCaptureAttempt } from "@/lib/progressCapture";
import "./reading-progress/progress-capture.css";

interface ProgressLoggerProps {
  bookId: string;
  bookTitle: string;
  currentPage?: number;
  totalPages?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void | Promise<unknown>;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/** An opening belongs to one book and account, independent of responsive headers. */
export const ProgressLogger = (props: ProgressLoggerProps) => {
  const { open, bookId, onOpenChange } = props;
  const { user, loading } = useAuth();
  const opening = useRef<{ userId: string; bookId: string } | null>(null);
  const allowed = !loading && !!user && (!opening.current ||
    (opening.current.userId === user.id && opening.current.bookId === props.bookId));
  useLayoutEffect(() => {
    if (!open) opening.current = null;
    else if (!allowed) onOpenChange(false);
    else if (!opening.current && user) opening.current = { userId: user.id, bookId };
  }, [open, bookId, onOpenChange, allowed, user]);
  return props.open && allowed && user
    ? <ProgressCaptureTask key={`${user.id}:${props.bookId}`} {...props} userId={user.id} /> : null;
};

type Field = "page" | "chapter" | "paragraph" | "minutes";
const wholeNumber = (value: string) => /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)) && Number(value) > 0;

function ProgressCaptureTask({ bookId, bookTitle, currentPage = 0, totalPages, onOpenChange, onSuccess, returnFocusRef, userId }: ProgressLoggerProps & { userId: string }) {
  const id = useId();
  const initialPage = useRef(currentPage > 0 ? String(currentPage) : "");
  const [draft, setDraft] = useState({ page: initialPage.current, chapter: "", paragraph: "", minutes: "", notes: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [details, setDetails] = useState(false);
  const [picker, setPicker] = useState(false);
  const [photo, setPhoto] = useState<{ url: string; preview: string } | null>(null);
  const [selection, setSelection] = useState<PickedImage | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [uploading, setUploading] = useState(false);
  const generation = useRef(0);
  const locked = useRef(false);
  const uploadLocked = useRef(false);
  const attempt = useRef<ProgressCaptureAttempt | null>(null);
  const pageRef = useRef<HTMLInputElement>(null);
  const photoTrigger = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const frozen = !!(attempt.current?.logCommitted || attempt.current?.logAttempted);
  useLayoutEffect(() => {
    generation.current += 1;
    return () => { generation.current += 1; };
  }, []);
  const dirty = draft.page !== initialPage.current || !!(draft.chapter || draft.paragraph || draft.minutes || draft.notes || photo || selection);
  const requestClose = (next: boolean) => {
    if (next || locked.current || uploadLocked.current) return;
    if (attempt.current?.bookCommitted) { onOpenChange(false); return; }
    if (dirty || frozen) setDiscard(true);
    else onOpenChange(false);
  };
  const update = (field: keyof typeof draft, value: string) => {
    setDraft(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
    setError("");
  };
  const upload = async (image: PickedImage) => {
    if (uploadLocked.current || locked.current || frozen) return;
    const owner = generation.current;
    uploadLocked.current = true;
    setSelection(image); setUploading(true); setPhotoError("");
    try {
      if (!image.base64) throw new Error("This image could not be read. Choose another photo.");
      const bytes = Uint8Array.from(atob(image.base64), character => character.charCodeAt(0));
      const url = await uploadPublicStorageFile("progress-photos", `${userId}/progress-${createLocalId()}.${image.format}`,
        new Blob([bytes], { type: `image/${image.format}` }), { contentType: `image/${image.format}` });
      if (generation.current !== owner) return;
      setPhoto({ url, preview: image.dataUrl }); setSelection(null);
    } catch (cause) {
      if (generation.current === owner) setPhotoError(cause instanceof Error ? cause.message : "Couldn't upload this photo. Retry or remove it to save without it.");
    } finally {
      if (generation.current === owner) { uploadLocked.current = false; setUploading(false); }
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (locked.current || uploadLocked.current || selection || attempt.current?.bookCommitted) return;
    const owner = generation.current;
    if (!attempt.current) {
      const nextErrors: Partial<Record<Field, string>> = {};
      if (!wholeNumber(draft.page) || (totalPages && Number(draft.page) > totalPages)) nextErrors.page = totalPages ? `Enter a whole page number from 1 to ${totalPages}.` : "Enter a whole page number greater than zero.";
      for (const field of ["minutes", "chapter", "paragraph"] as const) {
        if (draft[field].trim() && !wholeNumber(draft[field])) nextErrors[field] = "Enter a whole number greater than zero, or leave this empty.";
      }
      setErrors(nextErrors);
      const first = Object.keys(nextErrors)[0];
      if (first) {
        if (first !== "page") setDetails(true);
        requestAnimationFrame(() => { if (generation.current === owner) document.getElementById(`${id}-${first}`)?.focus(); });
        return;
      }
      attempt.current = createProgressCapture(userId, bookId, {
        pageNumber: Number(draft.page), chapterNumber: draft.chapter.trim() ? Number(draft.chapter) : null,
        paragraphNumber: draft.paragraph.trim() ? Number(draft.paragraph) : null, timeSpent: draft.minutes.trim() ? Number(draft.minutes) : null,
        notes: draft.notes, photoUrl: photo?.url ?? null,
      });
    }
    locked.current = true; setSaving(true); setError("");
    let saved;
    try {
      saved = await persistProgressCapture(attempt.current, () => generation.current === owner);
    } catch (cause) {
      if (generation.current !== owner) return;
      setError(attempt.current.logCommitted
        ? "Your reading log is saved on this device. We couldn't update the book's position. Retry to finish saving without adding another log."
        : attempt.current.logAttempted
          ? "We couldn't confirm this save. Retry to check this same log before creating anything else."
          : cause instanceof Error ? cause.message : "Couldn't save progress. Your draft is still here. Try again.");
      if (!attempt.current.logCommitted && !attempt.current.logAttempted) attempt.current = null;
      requestAnimationFrame(() => { if (generation.current === owner) errorRef.current?.focus(); });
      return;
    } finally {
      if (generation.current === owner) { locked.current = false; setSaving(false); }
    }
    if (generation.current !== owner) return;
    setComplete(true);
    // Refresh and notification failures cannot turn a durable local save into a retry.
    try { emitBooksChanged({ type: "upsert", userId, book: saved }); } catch (cause) { console.error(cause); }
    try { if (isConnectivityAvailable()) void readingCoreSync.syncUser(userId).catch(console.error); } catch (cause) { console.error(cause); }
    try { toast({ title: "Reading saved on this device", description: saved.status === "completed" ? `Page ${draft.page} saved. Book finished.` : `Page ${draft.page} saved.` }); } catch (cause) { console.error(cause); }
    try { onOpenChange(false); } catch (cause) { console.error("Reading saved; task close failed", cause); }
    try { await onSuccess?.(); } catch (cause) { console.error("Reading saved; refresh failed", cause); }
  };
  const field = (name: Field, label: string, help?: string) => <div className={`capture-field ${name === "page" ? "capture-page" : ""}`}>
    <label htmlFor={`${id}-${name}`}>{label}</label>
    <input ref={name === "page" ? pageRef : undefined} id={`${id}-${name}`} inputMode="numeric" autoComplete="off"
      value={draft[name]} onChange={event => update(name, event.target.value)} aria-required={name === "page" || undefined}
      aria-invalid={!!errors[name]} aria-describedby={`${help ? `${id}-${name}-help ` : ""}${errors[name] ? `${id}-${name}-error` : ""}`.trim() || undefined} />
    {help && <p id={`${id}-${name}-help`} className="capture-hint">{help}</p>}
    {errors[name] && <p id={`${id}-${name}-error`} className="capture-error">{errors[name]}</p>}
  </div>;
  return <>
    <Dialog open onOpenChange={requestClose}>
      <AdaptiveDialogContent className="progress-capture" showClose={!saving && !uploading}
        onOpenAutoFocus={event => { event.preventDefault(); pageRef.current?.focus(); }}
        onCloseAutoFocus={event => { if (returnFocusRef?.current?.isConnected) { event.preventDefault(); returnFocusRef.current.focus(); } }}>
        <AdaptiveDialogHeader><AdaptiveDialogTitle>Log reading progress</AdaptiveDialogTitle><AdaptiveDialogDescription>{bookTitle}</AdaptiveDialogDescription></AdaptiveDialogHeader>
        <form onSubmit={event => void submit(event)} noValidate aria-label="Log reading progress" aria-busy={saving || uploading}>
          <AdaptiveDialogBody>
            <fieldset disabled={saving || frozen} className="capture-fields">
              {field("page", "Page reached", totalPages ? `Out of ${totalPages} pages. Your saved place is page ${currentPage}.` : `Your saved place is page ${currentPage}. Total pages aren't set.`)}
              {totalPages && Number(draft.page) === totalPages ? <p className="capture-consequence">Saving this page also marks the book finished.</p> : null}
              {wholeNumber(draft.page) && Number(draft.page) < currentPage && <p className="capture-consequence">This adds a reading log and keeps your saved place at page {currentPage}. Use Correct current page to move your place back.</p>}
              <details className="capture-details" open={details} onToggle={event => setDetails(event.currentTarget.open)}>
                <summary>Time, notes and photo <span>Optional</span></summary>
                <div className="capture-extras">
                  {field("minutes", "Minutes read")}
                  <div className="capture-field"><label htmlFor={`${id}-notes`}>Reading notes</label><textarea id={`${id}-notes`} rows={3} value={draft.notes} onChange={event => update("notes", event.target.value)} /></div>
                  <div className="capture-position">{field("chapter", "Chapter")}{field("paragraph", "Paragraph")}</div>
                  <div className="capture-photo">
                    <p className="capture-label">Photo</p>
                    {photo && <img src={photo.preview} alt="Attached reading photo" />}
                    {selection && <img src={selection.dataUrl} alt="Selected photo awaiting upload" />}
                    <div className="capture-photo-actions">
                      <button ref={photoTrigger} type="button" className="capture-control" aria-disabled={uploading || !!selection} onClick={() => { if (!uploadLocked.current && !selection) setPicker(true); }}>{photo ? "Replace photo" : "Attach photo"}</button>
                      {photo && !selection && <button type="button" className="capture-control" onClick={() => setPhoto(null)}>Remove photo</button>}
                      {selection && !uploading && <><button type="button" className="capture-control" onClick={() => void upload(selection)}>Retry upload</button><button type="button" className="capture-control" onClick={() => { setSelection(null); setPhotoError(""); }}>Remove selected photo</button></>}
                    </div>
                    {uploading && <p role="status" className="capture-hint">Uploading photo. Keep this task open.</p>}
                    {photoError && <p role="alert" className="capture-error">{photoError}</p>}
                  </div>
                </div>
              </details>
            </fieldset>
            {error && <p ref={errorRef} role="alert" tabIndex={-1} className="capture-error">{error}</p>}
            <p role="status" className="sr-only">{saving ? "Saving reading progress on this device." : complete ? "Reading saved on this device." : ""}</p>
          </AdaptiveDialogBody>
          <AdaptiveDialogFooter>
            <button className="capture-control" type="button" disabled={saving || uploading} onClick={() => requestClose(false)}>{complete ? "Close task" : "Cancel"}</button>
            <button className="capture-control capture-submit" type="submit" disabled={complete || saving || uploading || !!selection}>{complete ? "Saved on this device" : saving ? "Saving progress..." : frozen ? "Retry save" : "Save progress"}</button>
            <p className="capture-hint capture-save-note">Reading saves on this device and syncs when connected. Photos need a connection.</p>
          </AdaptiveDialogFooter>
        </form>
        <ImagePickerDialog open={picker} onOpenChange={setPicker} onImagePicked={image => void upload(image)} returnFocusRef={photoTrigger} title="Add a reading photo" description="Take a photo or choose one from your library." />
      </AdaptiveDialogContent>
    </Dialog>
    <MobileAlertDialog open={discard} onOpenChange={setDiscard} title={frozen ? "Close this save?" : "Discard this progress draft?"}
      description={frozen ? "A reading log may already be saved on this device. Closing won't remove it. Keep this task open to finish the same save." : "Your unsaved page, notes and photo selection will be cleared."}
      cancelText={frozen ? "Keep task open" : "Keep editing"} confirmText={frozen ? "Close task" : "Discard draft"} variant="destructive" onConfirm={() => onOpenChange(false)} />
  </>;
}
